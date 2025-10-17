import {Entity, Column, PrimaryGeneratedColumn, ManyToOne} from "typeorm";
import { ChatSession } from "./ChatSession.entity";

@Entity()
export class Message{
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  content:string;

  @Column({type: "enum", enum: ['user', 'agent']})
  sender: 'user' | 'agent';

  @Column()
  chatSessionId: number;

  @ManyToOne(() => ChatSession, chatSession => chatSession.messages)
  chatSession: ChatSession;

  constructor(content: string, sender: 'user' | 'agent', chatSession: ChatSession){
    this.content = content;
    this.sender = sender;
    this.chatSession = chatSession;
  }
}
