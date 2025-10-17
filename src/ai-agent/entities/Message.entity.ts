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

  @ManyToOne(() => ChatSession, chatSession => chatSession.messages)
  chatSession: ChatSession;


}
