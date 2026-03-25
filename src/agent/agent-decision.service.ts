import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiProviderService } from '../ai-agent/ai-provider.service';
import { AiEvaluationLogService } from '../ai-agent/ai-evaluation.service';
import { AGENT_ACTIONS_PROMPT_V1 } from '../ai-agent/prompts/agent-actions.prompt';
import { AgentAutoExecuteDto } from './dto/agent-auto-execute.dto';

const DEFAULT_ALLOWED_ACTIONS = [
  'create_ticket',
  'update_ticket_status',
];

type AgentDecision = {
  execute: boolean;
  confidence: number;
  rationale?: string;
  actions: Array<{ type: string; payload: Record<string, any> }>;
};

@Injectable()
export class AgentDecisionService {
  constructor(
    private readonly aiProviderService: AiProviderService,
    private readonly aiEvaluationLogService: AiEvaluationLogService,
    private readonly configService: ConfigService,
  ) {}

  async decide(input: AgentAutoExecuteDto, organizationId: string) {
    const allowedActions = this.getAllowedActions(input.allowedActions);
    const maxActions = this.getMaxActions(input.maxActions);

    const prompt = AGENT_ACTIONS_PROMPT_V1.build(
      input.context,
      input.payload,
      allowedActions,
      maxActions,
    );

    const aiAgent = this.aiProviderService.getProvider();
    let response = '';

    try {
      response = await aiAgent.generateResponse(prompt);
      await this.aiEvaluationLogService.logSuccess({
        provider: aiAgent.providerName,
        prompt,
        response,
        context: aiAgent.context,
        organizationId,
        metadata: {
          type: 'agent-decision',
          promptVersion: AGENT_ACTIONS_PROMPT_V1.version,
          allowedActions,
          maxActions,
          source: input.source || null,
        },
      });
    } catch (error) {
      await this.aiEvaluationLogService.logFailure({
        provider: aiAgent.providerName,
        prompt,
        response: response || null,
        context: aiAgent.context,
        organizationId,
        errorMessage: error?.message || 'AI decision failed',
        metadata: {
          type: 'agent-decision',
          promptVersion: AGENT_ACTIONS_PROMPT_V1.version,
          allowedActions,
          maxActions,
          source: input.source || null,
        },
      });
      throw error;
    }

    const decision = this.parseDecision(response);
    const sanitized = this.validateDecision(decision, allowedActions, maxActions);
    return sanitized;
  }

  private parseDecision(response: string): AgentDecision {
    const cleanResponse = response
      .trim()
      .replace(/```(json)?/g, '')
      .replace(/```/g, '');

    const start = cleanResponse.indexOf('{');
    const end = cleanResponse.lastIndexOf('}');
    const extracted = start !== -1 && end !== -1 ? cleanResponse.slice(start, end + 1) : cleanResponse;

    try {
      return JSON.parse(extracted);
    } catch (error) {
      throw new BadRequestException('Invalid AI response format: expected JSON');
    }
  }

  private validateDecision(
    decision: AgentDecision,
    allowedActions: string[],
    maxActions: number,
  ): AgentDecision {
    if (!decision || typeof decision !== 'object') {
      throw new BadRequestException('Invalid AI decision');
    }

    const execute = Boolean((decision as any).execute);
    const confidenceRaw = (decision as any).confidence;
    const confidence = Number(confidenceRaw);
    if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
      throw new BadRequestException('Invalid AI decision confidence');
    }

    const actions = Array.isArray((decision as any).actions) ? (decision as any).actions : [];
    if (actions.length > maxActions) {
      throw new BadRequestException('AI returned too many actions');
    }

    const normalizedActions = actions.map((action) => {
      if (!action || typeof action !== 'object') {
        throw new BadRequestException('Invalid action item');
      }
      const type = typeof action.type === 'string' ? action.type.trim() : '';
      if (!type || !allowedActions.includes(type)) {
        throw new BadRequestException(`Unsupported action type: ${type || 'unknown'}`);
      }
      const payload = action.payload && typeof action.payload === 'object' ? action.payload : {};
      return { type, payload };
    });

    const rationale = typeof (decision as any).rationale === 'string' ? (decision as any).rationale : undefined;

    return {
      execute,
      confidence,
      rationale,
      actions: normalizedActions,
    };
  }

  private getAllowedActions(input?: string[]) {
    if (input && input.length > 0) {
      return input.map((value) => value.trim()).filter((value) => value.length > 0);
    }
    const raw = this.configService.get<string>('AGENT_ALLOWED_ACTIONS');
    if (raw) {
      const fromEnv = raw
        .split(',')
        .map((value) => value.trim())
        .filter((value) => value.length > 0);
      if (fromEnv.length) {
        return fromEnv;
      }
    }
    return DEFAULT_ALLOWED_ACTIONS;
  }

  private getMaxActions(input?: number) {
    if (typeof input === 'number' && Number.isFinite(input)) {
      return Math.min(Math.max(Math.floor(input), 1), 25);
    }
    const raw = this.configService.get<string>('AGENT_ACTION_MAX_BATCH');
    const parsed = raw ? Number(raw) : NaN;
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return 5;
    }
    return Math.min(Math.floor(parsed), 25);
  }
}
