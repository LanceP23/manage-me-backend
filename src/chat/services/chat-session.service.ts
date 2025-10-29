import { Injectable, forwardRef, Inject } from '@nestjs/common';
import { ChatSession } from '../entities/ChatSession.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Equal, Repository } from 'typeorm';
import { MessageService } from './message.service';
import { User } from '../../users/entities/user.entity';
import { ProductContextService } from 'src/product-context/services/product-context.service';

@Injectable()
export class ChatSessionService {
  constructor(
    @InjectRepository(ChatSession)
    private chatSessionRepository: Repository<ChatSession>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private messageService: MessageService,
    @Inject(forwardRef(() => ProductContextService))
    private productContext: ProductContextService,
  ) {}

  async createChatSession(user?: any): Promise<ChatSession> {
    try {
      const chatSession = new ChatSession();
      chatSession.messages = [];

      // If a user is provided, associate the chat session with the user
      if (user && user.userId) {
        // Fetch the full user entity from the database
        const fullUser = await this.userRepository.findOneBy({
          id: user.userId,
        });
        if (fullUser) {
          chatSession.user = fullUser;
        }
      }

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
        relations: ['user'], // Load the user relation to check ownership
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
    const additionalContext = this.productContext.parseResponseToJson;

    const prompt = `
    You are given the full chat history below:

    ${rawContext}

    Using this history, generate a concise and coherent summary or context representation that captures all key details, topics, and intents discussed.
    The goal is to provide an LLM with enough information to fully understand the conversation so it can continue naturally and accurately.
    `;

    return aiAgent.generateResponse(prompt);
  }
}

