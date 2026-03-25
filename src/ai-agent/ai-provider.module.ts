import { Module } from '@nestjs/common';
import { AiProviderService } from './ai-provider.service';
import { GoogleGeminiAi } from './entities/GoogleGeminiAi.entity';
import { OllamaAi } from './entities/OllamaAi.entity';

@Module({
  providers: [AiProviderService, GoogleGeminiAi, OllamaAi],
  exports: [AiProviderService],
})
export class AiProviderModule {}
