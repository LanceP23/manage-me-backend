import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatSession } from '../chat/entities/ChatSession.entity';
import { AiAgentInterface } from './interfaces/AiAgent.interface';
import { ChatSessionService } from '../chat/services/chat-session.service';
import { MessageService } from '../chat/services/message.service';

@Injectable()
export class AiAgentService {
  constructor(
    private chatSessionService: ChatSessionService,
    private messageService: MessageService,
    private configService: ConfigService,
  ) {}

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

        // Create and save messages using the message service
        await this.messageService.createMultipleMessages([
          {
            content: prompt,
            sender: 'user',
            chatSession: chatSession,
          },
          {
            content: response || 'No Response From Gemini',
            sender: 'agent',
            chatSession: chatSession,
          },
        ]);
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
