import { Injectable } from '@nestjs/common';
import { ChatSession } from '../entities/ChatSession.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Equal, Repository } from 'typeorm';
import { MessageService } from './message.service';

@Injectable()
export class ChatSessionService {
  constructor(
    @InjectRepository(ChatSession)
    private chatSessionRepository: Repository<ChatSession>,
    private messageService: MessageService,
  ) {}
  async createChatSession(): Promise<ChatSession> {
    try {
      const chatSession = new ChatSession();
      chatSession.messages = [];
      const savedChatSession =
        await this.chatSessionRepository.save(chatSession);

      if (!savedChatSession) {
        throw new Error('Failed to create chat session');
      }

      return savedChatSession;
    } catch (error) {
      throw new Error(`Failed to create chat session: ${error.message}`);
    }
  }

  async getAllChatSessions(userId: number): Promise<ChatSession[]> {
    try {
      const userChatSessions = await this.chatSessionRepository.find({
        where: {
          user: Equal(userId),
        },
        relations: ['user'],
      });

      if (!userChatSessions) {
        throw new Error('No Chat Session Found');
      }

      return userChatSessions;
    } catch (error) {
      throw Error(error);
    }
  }

  async findChatSessionById(id: number): Promise<ChatSession> {
    try {
      const existingChatSession = await this.chatSessionRepository.findOne({
        where: {
          id: id,
        },
      });

      if (!existingChatSession) {
        throw new Error('No Chat Session Found');
      }

      return existingChatSession;
    } catch (error) {
      throw Error(error);
    }
  }

  async getChatHistory(chatSessionId: number): Promise<string> {
    const messages =
      await this.messageService.findMessagesByChatSessionId(chatSessionId);
    return messages.map((msg) => `${msg.sender}: ${msg.content}`).join('\n');
  }

  async getContextWithAiEnhancement(
    chatSessionId: number,
    aiAgent: any,
  ): Promise<string> {
    const rawContext = await this.getChatHistory(chatSessionId);

    const prompt = `
    You are given the full chat history below:

    ${rawContext}

    Using this history, generate a concise and coherent summary or context representation that captures all key details, topics, and intents discussed.
    The goal is to provide an LLM with enough information to fully understand the conversation so it can continue naturally and accurately.
    `;

    return aiAgent.generateResponse(prompt);
  }
}
