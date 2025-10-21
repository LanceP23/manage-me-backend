import { Injectable } from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';
import { AiAgentInterface } from '../interfaces/AiAgent.interface';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GoogleGeminiAi implements AiAgentInterface {
  readonly providerName = 'Gemini';
  private ai: GoogleGenAI;

  constructor(private configService: ConfigService) {
    this.ai = new GoogleGenAI({});
  }

  async generateResponse(prompt: string): Promise<string> {
    const response = await this.ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `You are a useful AI assistant. ${prompt}`,
    });

    if (!response.text) {
      throw new Error('Generating response from Gemini failed.');
    }

    return response.text;
  }

  validateApiKey(): boolean {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      return false;
    }

    return true;
  }
}
