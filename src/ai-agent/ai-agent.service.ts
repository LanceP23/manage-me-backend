import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
        const userMessage = new Message();
        userMessage.content = prompt;
        userMessage.sender = "user";
        userMessage.chatSession = savedChatSession;

        const agentMessage = new Message();
        agentMessage.sender = "agent";
        agentMessage.content = response?.text || 'No Response From Gemini';
        agentMessage.chatSession = savedChatSession;

        chatSession.messages.push(
          userMessage,
          agentMessage
        )

        await this.chatSessionRepository.save(chatSession);
        await this.messageRepository.save(userMessage);
        await this.messageRepository.save(agentMessage);

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
