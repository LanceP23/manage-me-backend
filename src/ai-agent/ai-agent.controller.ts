import { Controller, Get, Post, Body, HttpStatus } from '@nestjs/common';
import { AiAgentService } from './ai-agent.service';
import { SendPromptDto } from './dto/send-prompt-dto';
import { GoogleGeminiAi } from './entities/GoogleGeminiAi.entity';

@Controller()
export class AiAgentController {
  constructor(
    private readonly aiAgentService: AiAgentService,
    private readonly googleGemini: GoogleGeminiAi,
  ) {}

  @Post('/prompt-ai')
  async promptAi(@Body() sendPromptDto: SendPromptDto) {
    try {
      const response = await this.aiAgentService.promptAiAgent(
        sendPromptDto.prompt,
        this.googleGemini,
        sendPromptDto.chatSessionId,
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
