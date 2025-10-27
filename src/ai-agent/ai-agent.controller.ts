import { Controller, Post, Body, HttpStatus, UseGuards, Request } from '@nestjs/common';
import { AiAgentService } from './ai-agent.service';
import { SendPromptDto } from './dto/send-prompt-dto';
import { GoogleGeminiAi } from './entities/GoogleGeminiAi.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller()
@UseGuards(JwtAuthGuard)
export class AiAgentController {
  constructor(
    private readonly aiAgentService: AiAgentService,
    private readonly googleGemini: GoogleGeminiAi,
  ) {}

  @Post('/prompt-ai')
  async promptAi(@Body() sendPromptDto: SendPromptDto, @Request() req) {
    try {
      // Pass the authenticated user to the service
      const user = req.user;
      
      const response = await this.aiAgentService.promptAiAgent(
        sendPromptDto.prompt,
        this.googleGemini,
        sendPromptDto.chatSessionId,
        user, // Pass user to associate with chat session
      );

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