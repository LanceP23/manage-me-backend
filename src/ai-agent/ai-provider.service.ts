import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiAgentInterface } from './interfaces/AiAgent.interface';
import { GoogleGeminiAi } from './entities/GoogleGeminiAi.entity';
import { OllamaAi } from './entities/OllamaAi.entity';
import { FallbackAiAgent } from './entities/FallbackAiAgent.entity';

@Injectable()
export class AiProviderService {
  constructor(
    private readonly configService: ConfigService,
    private readonly googleGemini: GoogleGeminiAi,
    private readonly ollamaAi: OllamaAi,
  ) {}

  getProvider(): AiAgentInterface {
    const provider =
      this.configService.get<string>('LLM_PROVIDER')?.toLowerCase() || 'gemini';

    const primary = provider === 'ollama' ? this.ollamaAi : this.googleGemini;
    const fallback = provider === 'ollama' ? this.googleGemini : this.ollamaAi;

    return new FallbackAiAgent(primary, fallback);
  }
}
