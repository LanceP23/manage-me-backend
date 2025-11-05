import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  OneToOne,
  CreateDateColumn,
  OneToMany,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { User } from 'src/users/entities/user.entity';
import { ProductContext } from 'src/product-context/entities/ProductContext.entity';
import { Ticket } from 'src/ticket/entities/ticket.entity';

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

  @OneToMany(() => Ticket, (ticket) => ticket.product)
  tickets: Ticket[];
}
