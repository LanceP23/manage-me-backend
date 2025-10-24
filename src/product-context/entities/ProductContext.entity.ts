import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  OneToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Product } from 'src/product/entities/Product.entity';
import { ProductQuestion } from 'src/product-question/entities/product-question.entity';
import { Answer } from 'src/answer/entities/answer.entity';

@Entity()
export class ProductContext {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToMany(
    () => ProductQuestion,
    (productQuestion) => productQuestion.productContext,
  )
  productQuestions: ProductQuestion[];

  @OneToMany(() => Answer, (answer) => answer.productContext)
  answers: Answer[];

  // ✅ Back reference to Product
  @OneToOne(() => Product, (product) => product.productContext)
  @JoinColumn()
  product: Product;

  @CreateDateColumn()
  createdAt: Date;
}
