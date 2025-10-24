import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  OneToOne,
  CreateDateColumn,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { User } from 'src/users/entities/user.entity';
import { ProductContext } from 'src/product-context/entities/ProductContext.entity';

@Entity()
export class Product {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  domain: string;

  @OneToOne(() => ProductContext, (productContext) => productContext.product)
  productContext: ProductContext;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => User, (user) => user.chatSessions)
  user: User;
}
