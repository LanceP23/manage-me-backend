import { Controller, Get, Post, Body } from '@nestjs/common';
import { AiAgentService } from './ai-agent.service';
import { SendPromptDto } from './dto/send-prompt-dto';

@Controller()
export class AiAgentController {
  constructor(private readonly aiAgentService: AiAgentService) {}

  @Post("/prompt-ai")
  getHello(@Body() sendPromptDto: SendPromptDto): Promise<string> {
    return this.aiAgentService.promptAiAgent(sendPromptDto.prompt);
  }
}
