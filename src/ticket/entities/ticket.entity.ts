import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Product } from '../../product/entities/Product.entity';

@Entity()
export class Ticket {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({
    type: 'enum',
    enum: ['todo', 'in_progress', 'done', 'cancelled'],
    default: 'todo',
  })
  status: string;

  @Column({
    type: 'enum',
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium',
  })
  priority: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => User, (user) => user.tickets, { nullable: true })
  assignedTo: User | null;

  @ManyToOne(() => Product, (product) => product.tickets, { nullable: true })
  product: Product | null;
}