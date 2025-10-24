import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { ProductContext } from 'src/product-context/entities/ProductContext.entity';
import { Answer } from 'src/answer/entities/answer.entity';

@Entity()
export class ProductQuestion {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  questionText: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(
    () => ProductContext,
    (productContext) => productContext.productQuestions,
  )
  @JoinColumn()
  productContext: ProductContext;

  @OneToMany(() => Answer, (answer) => answer.productQuestion)
  answers: Answer[];
}
