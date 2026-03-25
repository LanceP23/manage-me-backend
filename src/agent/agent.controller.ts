import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { OrgGuard } from '../organization/guards/org.guard';
import { AgentActionService } from './agent-action.service';
import { AgentExecuteDto } from './dto/agent-execute.dto';
import { AgentAutoExecuteDto } from './dto/agent-auto-execute.dto';
import { AgentDecisionService } from './agent-decision.service';
import { UsageService } from '../usage/usage.service';

@Controller('agent')
@UseGuards(JwtAuthGuard, OrgGuard, AdminGuard)
export class AgentController {
  constructor(
    private readonly agentActionService: AgentActionService,
    private readonly agentDecisionService: AgentDecisionService,
    private readonly usageService: UsageService,
  ) {}

  @Post('execute')
  async execute(@Body() body: AgentExecuteDto, @Request() req) {
    const userId = req.user?.userId as string | undefined;
    const organizationId = req.organizationId as string;

    await this.usageService.assertWithinLimit(
      organizationId,
      'agent_action',
      body.actions?.length || 1,
    );

    const response = await this.agentActionService.executeActions(
      body,
      userId,
      organizationId,
    );

    if (!body.dryRun) {
      await this.usageService.recordEvent({
        organizationId,
        userId,
        kind: 'agent_action',
        quantity: response.results?.length || 1,
      });
    }

    return response;
  }

  @Post('auto-execute')
  async autoExecute(@Body() body: AgentAutoExecuteDto, @Request() req) {
    const userId = req.user?.userId as string | undefined;
    const organizationId = req.organizationId as string;

    const decision = await this.agentDecisionService.decide(body, organizationId);
    const inferredStatus =
      typeof (body as any)?.payload?.suggestedStatus === 'string'
        ? String((body as any).payload.suggestedStatus)
        : typeof (body as any)?.payload?.status === 'string'
          ? String((body as any).payload.status)
          : undefined;
    if (decision?.actions?.length) {
      decision.actions = decision.actions.map((action) => {
        if (
          action.type === 'update_ticket_status' &&
          (!action.payload || typeof action.payload.status !== 'string')
        ) {
          return {
            ...action,
            payload: {
              ...(action.payload || {}),
              status: inferredStatus || 'in_progress',
            },
          };
        }
        return action;
      });
    }
    const dryRun = body.dryRun !== undefined ? body.dryRun : true;

    if (!decision.execute) {
      return {
        dryRun,
        decision,
        results: [],
        message: 'Decision returned execute=false',
      };
    }

    await this.usageService.assertWithinLimit(
      organizationId,
      'agent_action',
      decision.actions?.length || 1,
    );

    const response = await this.agentActionService.executeActions(
      {
        actions: decision.actions,
        decision: {
          confidence: decision.confidence,
          rationale: decision.rationale,
          promptVersion: 'agent-actions',
          source: body.source,
        },
        dryRun,
      },
      userId,
      organizationId,
    );

    if (!dryRun) {
      await this.usageService.recordEvent({
        organizationId,
        userId,
        kind: 'agent_action',
        quantity: response.results?.length || 1,
        metadata: { auto: true },
      });
    }

    return response;
  }
}
