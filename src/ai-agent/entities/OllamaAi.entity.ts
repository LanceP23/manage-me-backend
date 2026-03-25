import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { AiAgentInterface } from '../interfaces/AiAgent.interface';
import * as fs from 'fs';

@Injectable()
export class OllamaAi implements AiAgentInterface {
  readonly providerName = 'Ollama';
  context: string = 'No Context Built Yet';

  constructor(private configService: ConfigService) {}

  private getBaseUrl(): string {
    return (
      this.configService.get<string>('OLLAMA_BASE_URL') ||
      'http://localhost:11434'
    );
  }

  private getModel(): string {
    return this.configService.get<string>('LLM_MODEL') || 'llama2';
  }

  async generateResponse(prompt: string): Promise<string> {
    const baseUrl = this.getBaseUrl();
    const model = this.getModel();
    const fullPrompt = this.context
      ? `Chat History:\n${this.context}\n\nCurrent Prompt: ${prompt}`
      : `You are a useful AI assistant. ${prompt}`;

    const response = await axios.post(`${baseUrl}/api/generate`, {
      model,
      prompt: fullPrompt,
      stream: false,
    });

    const text = response?.data?.response;
    if (!text) {
      throw new Error('Generating response from Ollama failed.');
    }

    return text;
  }

  async generateResponseWithImage(
    prompt: string,
    imagePath: string,
  ): Promise<string> {
    const baseUrl = this.getBaseUrl();
    const model = this.getModel();

    const imageBase64 = fs.readFileSync(imagePath, 'base64');

    const response = await axios.post(`${baseUrl}/api/generate`, {
      model,
      prompt,
      images: [imageBase64],
      stream: false,
    });

    const text = response?.data?.response;
    if (!text) {
      throw new Error('Generating response with image from Ollama failed.');
    }

    return text;
  }

  validateApiKey(): boolean {
    // Local Ollama does not require an API key
    return true;
  }
}
