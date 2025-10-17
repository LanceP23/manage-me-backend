import {Entity, Column, PrimaryGeneratedColumn, OneToMany, CreateDateColumn} from "typeorm";
import { Message } from "./Message.entity";

@Entity()
export class ChatSession{
  @PrimaryGeneratedColumn()
  id: number;

  @OneToMany(() => Message, message => message.chatSession, {cascade: true})
  messages: Message[];

  @CreateDateColumn()
  createdAt: Date;

}
