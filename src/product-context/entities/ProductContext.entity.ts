import { User } from 'src/users/entities/user.entity';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  OneToOne,
  CreateDateColumn,
  ManyToOne,
} from 'typeorm';
import { Product } from 'src/product/entities/Product.entity';

@Entity()
export class ProductContext {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn()
  createdAt: Date;

  // ✅ Back reference to Product
  @OneToOne(() => Product, (product) => product.productContext)
  product: Product;

  @ManyToOne(() => User, (user) => user.chatSessions)
  user: User;
}
