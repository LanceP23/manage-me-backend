import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';

@Injectable()
export class AiAgentService {
  private ai: GoogleGenAI;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is required');
    }
    this.ai = new GoogleGenAI({});
  }

  async promptAiAgent(prompt: string): Promise<string> {
    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `You are a useful AI assistant. ${prompt}`,
      });

      const text = response?.text || 'No Response from Agent';
      console.log('Gemini response:', text);
      return text;
    } catch (error) {
      console.error('Gemini API Error:', error);
      throw new Error(`Failed to process AI prompt: ${error.message}`);
    }
  }
}
