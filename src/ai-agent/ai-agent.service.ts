import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Chat, GoogleGenAI } from '@google/genai';
import { InjectRepository } from '@nestjs/typeorm';
import { PrimaryColumnCannotBeNullableError, Repository } from 'typeorm';
import { ChatSession } from './entities/ChatSession.entity';
import { Message } from './entities/Message.entity';
import { error } from 'console';

@Injectable()
export class AiAgentService {
  private ai: GoogleGenAI;

  constructor(
    @InjectRepository(ChatSession)
    private chatSessionRepository: Repository<ChatSession>,
    @InjectRepository(Message) private messageRepository: Repository<Message>,
    private configService: ConfigService,
  ) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is required');
    }
    this.ai = new GoogleGenAI({});
  }

  async createChatSession(): Promise<ChatSession> {
    const chatSession = new ChatSession();
    chatSession.messages = [];
    const savedChatSession = await this.chatSessionRepository.save(chatSession);
    return savedChatSession;
  }

  async promptAiAgent(
    prompt: string,
    existingChatSessionId?: number,
  ): Promise<string> {
    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `You are a useful AI assistant. ${prompt}`,
      });
      let chatSession: ChatSession;
      if (response?.text) {
        if (!existingChatSessionId) {
          chatSession = new ChatSession();
          chatSession.messages = [];
          chatSession = await this.chatSessionRepository.save(chatSession);
        } else {
          const existingChatSession = await this.chatSessionRepository.findOne({
            where: {
              id: existingChatSessionId,
            },
          });
          if (!existingChatSession) {
            return JSON.stringify({
              message: 'Existing Session Not Found',
            });
          }
          chatSession = existingChatSession;
        }

        // Create and save messages directly using the message repository
        const userMessage = new Message(prompt, 'user', chatSession);
        const agentMessage = new Message(
          response?.text || 'No Response From Gemini',
          'agent',
          chatSession,
        );

        // Save messages directly instead of through cascade
        await this.messageRepository.save([userMessage, agentMessage]);
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
