import { Controller, Get } from '@nestjs/common';
import { AiAgentService } from './ai-agent.service';

@Controller()
export class AiAgentController {
  constructor(private readonly aiAgentService: AiAgentService) {}

  @Get()
  getHello(): Promise<string> {
    return this.aiAgentService.promptAiAgent('Hello');
  }
}
