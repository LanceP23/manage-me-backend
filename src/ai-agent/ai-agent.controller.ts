import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { AiAgentService } from './ai-agent.service';
import { SendPromptDto } from './dto/send-prompt-dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AiProviderService } from './ai-provider.service';
import { OrgGuard } from '../organization/guards/org.guard';
import { UsageService } from '../usage/usage.service';

@Controller()
@UseGuards(JwtAuthGuard, OrgGuard)
export class AiAgentController {
  constructor(
    private readonly aiAgentService: AiAgentService,
    private readonly aiProvider: AiProviderService,
    private readonly usageService: UsageService,
  ) {}

  @Post('/prompt-ai')
  async promptAi(@Body() sendPromptDto: SendPromptDto, @Request() req) {
    try {
      // Pass the authenticated user to the service
      const user = req.user;
      const organizationId = req.organizationId;

      await this.usageService.assertWithinLimit(organizationId, 'ai_prompt');

      const aiAgent = this.aiProvider.getProvider();

      const response = await this.aiAgentService.promptAiAgent(
        sendPromptDto.prompt,
        aiAgent,
        sendPromptDto.chatSessionId,
        user,
        organizationId,
      );

      await this.usageService.recordEvent({
        organizationId,
        userId: user?.id,
        kind: 'ai_prompt',
      });

      return {
        status: 'success',
        data: {
          response: response.response,
          chatSessionId: response.chatSessionId,
        },
        success: true,
      };
    } catch (error) {
      return {
        status: 'error',
        message: error.message || 'An unexpected error occurred',
        success: false,
      };
    }
  }
}
