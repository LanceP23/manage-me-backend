import { Entity, Column, Unique, BeforeInsert, BeforeUpdate, OneToMany } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';
import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';
import * as bcrypt from 'bcrypt';
import { Exclude } from 'class-transformer';
import { ChatSession } from '../../chat/entities/ChatSession.entity';
import { Answer } from '../../answer/entities/answer.entity';

@Entity('users')
@Unique(['email'])
export class User extends BaseEntity {
  @Column({ type: 'varchar', length: 100 })
  @IsNotEmpty()
  firstName: string;

  @Column({ type: 'varchar', length: 100 })
  @IsNotEmpty()
  lastName: string;

  @Column({ type: 'varchar', length: 255 })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @Column({ type: 'varchar', length: 255 })
  @MinLength(6)
  @IsNotEmpty()
  @Exclude()
  password: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @BeforeInsert()
  @BeforeUpdate()
  async hashPassword() {
    if (this.password) {
      this.password = await bcrypt.hash(this.password, 10);
    }
  }

  async validatePassword(password: string): Promise<boolean> {
    return await bcrypt.compare(password, this.password);
  }

  @OneToMany(() => ChatSession, chatSession => chatSession.user)
  chatSessions: ChatSession[];

  @OneToMany(() => Answer, answer => answer.user)
  answers: Answer[];
}
