import { Controller, Get, Post, Body } from '@nestjs/common';
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
  promptAi(@Body() sendPromptDto: SendPromptDto): Promise<string> {
    if (sendPromptDto.chatSessionId) {
      return this.aiAgentService.promptAiAgent(
        sendPromptDto.prompt,
        this.googleGemini,
        sendPromptDto.chatSessionId,
      );
    }

    return this.aiAgentService.promptAiAgent(
      sendPromptDto.prompt,
      this.googleGemini,
    );
  }
}
