import { Controller, Post, Get, Param, UseGuards, Request, BadRequestException, HttpCode, HttpStatus } from '@nestjs/common';
import { ChatSessionService } from './services/chat-session.service';
import { ChatSession } from './entities/ChatSession.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('chat-sessions')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatSessionService: ChatSessionService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createChatSession(@Request() req): Promise<ChatSession> {
    const user = req.user;

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const chatSession = new ChatSession();
    chatSession.user = user;
    chatSession.messages = [];

    return await this.chatSessionService.createChatSession();
  }

  @Get()
  async getAllChatSessions(@Request() req): Promise<ChatSession[]> {
    const user = req.user;
    
    if (!user) {
      throw new BadRequestException('User not authenticated');
    }
    
    return await this.chatSessionService.getAllChatSessions(user.userId);
  }

  @Get(':id')
  async getChatSessionById(@Param('id') id: number, @Request() req): Promise<ChatSession> {
    const user = req.user;
    
    if (!user) {
      throw new BadRequestException('User not authenticated');
    }
    
    const chatSession = await this.chatSessionService.findChatSessionById(id);
    
    // Check if the chat session belongs to the authenticated user
    if (chatSession.user.id !== user.userId) {
      throw new BadRequestException('Access denied: This chat session does not belong to you');
    }
    
    return chatSession;
  }
}