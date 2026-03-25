import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { ChatSession } from '../chat/entities/ChatSession.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { OrganizationModule } from '../organization/organization.module';
import { AdminGuard } from '../auth/guards/admin.guard';

@Module({
  imports: [TypeOrmModule.forFeature([User, ChatSession]), OrganizationModule],
  controllers: [UsersController],
  providers: [UsersService, AdminGuard],
  exports: [UsersService],
})
export class UsersModule {}
