import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
  JoinColumn,
} from 'typeorm';
import { ProductContext } from 'src/product-context/entities/ProductContext.entity';
import { ProductQuestion } from 'src/product-question/entities/product-question.entity';
import { User } from 'src/users/entities/user.entity';

@Entity()
export class Answer {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  answerText: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => ProductContext, (productContext) => productContext.answers)
  productContext: ProductContext;

  @ManyToOne(() => ProductQuestion, (productQuestion) => productQuestion.answers, { nullable: true })
  productQuestion?: ProductQuestion;

  @ManyToOne(() => User, (user) => user.answers)
  user: User;
}