import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Chat, GoogleGenAI } from '@google/genai';
import { InjectRepository } from '@nestjs/typeorm';
import { PrimaryColumnCannotBeNullableError, Repository } from 'typeorm';
import { ChatSession } from './entities/ChatSession.entity';
import { Message } from './entities/Message.entity';

@Injectable()
export class AiAgentService {
  private ai: GoogleGenAI;

  constructor(@InjectRepository(ChatSession)private chatSessionRepository: Repository<ChatSession>, @InjectRepository(Message)private messageRepository: Repository<Message>,private configService: ConfigService) {
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

      if(response?.text){
        //save in database when success
        const chatSession = new ChatSession();
        chatSession.messages = [];
        const savedChatSession = await this.chatSessionRepository.save(chatSession);

        const userMessage = new Message(prompt, "user", savedChatSession);
        const agentMessage = new Message(response?.text || "No Response From Gemini", 'agent', savedChatSession);

        savedChatSession.messages.push(
          userMessage,
          agentMessage
        )
        
        await this.chatSessionRepository.save(savedChatSession);

      }

      const text = response?.text || 'No Response from Agent';
      console.log('Gemini response:', text);
      return text;
    } catch (error) {
      console.error('Gemini API Error:', error);
      throw new Error(`Failed to process AI prompt: ${error.message}`);
    }
  }

}
