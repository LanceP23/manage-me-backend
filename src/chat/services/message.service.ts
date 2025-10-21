import { Injectable } from '@nestjs/common';
import { Message } from '../entities/Message.entity';
import { ChatSession } from '../entities/ChatSession.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class MessageService {
  constructor(
    @InjectRepository(Message)
    private messageRepository: Repository<Message>,
  ) {}

  async createMessage(
    content: string,
    sender: 'user' | 'agent',
    chatSession: ChatSession,
  ): Promise<Message> {
    try {
      const message = new Message(content, sender, chatSession);
      const savedMessage = await this.messageRepository.save(message);

      if (!savedMessage) {
        throw new Error('Failed to create message');
      }

      return savedMessage;
    } catch (error) {
      throw new Error(`Failed to create message: ${error.message}`);
    }
  }

  async createMultipleMessages(
    messages: Array<{
      content: string;
      sender: 'user' | 'agent';
      chatSession: ChatSession;
    }>,
  ): Promise<Message[]> {
    try {
      const messageEntities = messages.map(
        (msg) => new Message(msg.content, msg.sender, msg.chatSession),
      );

      const savedMessages = await this.messageRepository.save(messageEntities);

      if (!savedMessages || savedMessages.length === 0) {
        throw new Error('Failed to create messages');
      }

      return savedMessages;
    } catch (error) {
      throw new Error(`Failed to create messages: ${error.message}`);
    }
  }

  async findMessagesByChatSessionId(chatSessionId: number): Promise<Message[]> {
    try {
      return await this.messageRepository.find({
        where: { chatSessionId },
        order: { id: 'ASC' },
      });
    } catch (error) {
      throw new Error(`Failed to find messages: ${error.message}`);
    }
  }
}
