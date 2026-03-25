import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatSession } from '../chat/entities/ChatSession.entity';
import { AiAgentInterface } from './interfaces/AiAgent.interface';
import { ChatSessionService } from '../chat/services/chat-session.service';
import { MessageService } from '../chat/services/message.service';
import { AiEvaluationLogService } from './ai-evaluation.service';

@Injectable()
export class AiAgentService {
  constructor(
    private chatSessionService: ChatSessionService,
    private messageService: MessageService,
    private configService: ConfigService,
    private aiEvaluationLogService: AiEvaluationLogService,
  ) {}

  async promptAiAgent(
    prompt: string,
    aiAgent: AiAgentInterface,
    existingChatSessionId?: number,
    user?: any,
    organizationId?: string,
  ): Promise<{ response: string; chatSessionId: number }> {
    try {
      let chatSession: ChatSession;

      if (!existingChatSessionId) {
        chatSession = await this.chatSessionService.createChatSession(user);
      } else {
        const existingChatSession =
          await this.chatSessionService.findChatSessionById(
            existingChatSessionId,
          );
        chatSession = existingChatSession;
      }

      if (!aiAgent.validateApiKey()) {
        throw new Error('No Api Key');
      }

      aiAgent.context =
        await this.chatSessionService.getContextWithAiEnhancement(
          chatSession.id,
          aiAgent,
        );

      const response = await aiAgent.generateResponse(prompt);

      if (response) {
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
      console.log('AI response:', text);
      await this.aiEvaluationLogService.logSuccess({
        provider: aiAgent.providerName,
        prompt,
        response: text,
        context: aiAgent.context,
        organizationId,
        metadata: { chatSessionId: chatSession.id },
      });
      return {
        response: text,
        chatSessionId: chatSession.id,
      };
    } catch (error) {
      console.error('AI API Error:', error);
      await this.aiEvaluationLogService.logFailure({
        provider: aiAgent.providerName,
        prompt,
        context: aiAgent.context,
        organizationId,
        errorMessage: error?.message || 'Unknown error',
      });
      throw new Error(`Failed to process AI prompt: ${error.message}`);
    }
  }
}
