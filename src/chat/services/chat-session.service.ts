import { Injectable } from '@nestjs/common';
import { ChatSession } from '../entities/ChatSession.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class ChatSessionService {
  constructor(
    @InjectRepository(ChatSession)
    private chatSessionRepository: Repository<ChatSession>,
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
}
