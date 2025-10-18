import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Chat, GoogleGenAI } from '@google/genai';
import { InjectRepository } from '@nestjs/typeorm';
import { PrimaryColumnCannotBeNullableError, Repository } from 'typeorm';
import { ChatSession } from './entities/ChatSession.entity';
import { Message } from './entities/Message.entity';
import { AiAgentInterface } from './interfaces/AiAgent.interface';
import { ChatSessionService } from './chatSession.service';

@Injectable()
export class AiAgentService {
  constructor(
    @InjectRepository(ChatSession)
    private chatSessionRepository: Repository<ChatSession>,
    @InjectRepository(Message) private messageRepository: Repository<Message>,
    private chatSessionService: ChatSessionService,
    private configService: ConfigService,
  ) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is required');
    }
  }

  async promptAiAgent(
    prompt: string,
    aiAgentInterface: AiAgentInterface,
    existingChatSessionId?: number,
  ): Promise<string> {
    try {
      const response = await aiAgentInterface.generateResponse(prompt);
      let chatSession: ChatSession;

      if (!aiAgentInterface.validateApiKey()) {
        throw new Error('No Api Key');
      }
      if (response) {
        if (!existingChatSessionId) {
          chatSession = await this.chatSessionService.createChatSession();
        } else {
          const existingChatSession =
            await this.chatSessionService.findChatSessionById(
              existingChatSessionId,
            );
          chatSession = existingChatSession;
        }

        // Create and save messages directly using the message repository
        const userMessage = new Message(prompt, 'user', chatSession);
        const agentMessage = new Message(
          response || 'No Response From Gemini',
          'agent',
          chatSession,
        );

        // Save messages directly instead of through cascade
        await this.messageRepository.save([userMessage, agentMessage]);
      }
      const text = response || 'No Response from Agent';
      console.log('Gemini response:', text);
      return text;
    } catch (error) {
      console.error('Gemini API Error:', error);
      throw new Error(`Failed to process AI prompt: ${error.message}`);
    }
  }
}
