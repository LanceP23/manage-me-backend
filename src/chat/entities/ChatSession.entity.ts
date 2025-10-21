import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  OneToMany,
  CreateDateColumn,
  ManyToOne,
} from 'typeorm';
import { Message } from './Message.entity';
import { User } from '../../users/entities/user.entity';

@Entity()
export class ChatSession {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToMany(() => Message, (message) => message.chatSession, { cascade: true })
  messages: Message[];

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => User, (user) => user.chatSessions)
  user: User;
}
