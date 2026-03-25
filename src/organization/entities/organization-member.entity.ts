import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  Index,
} from 'typeorm';
import { Organization } from './organization.entity';
import { User } from '../../users/entities/user.entity';

@Entity()
@Index(['organization', 'user'], { unique: true })
export class OrganizationMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: ['owner', 'admin', 'member', 'viewer'],
    default: 'member',
  })
  role: string;

  @ManyToOne(() => Organization, (org) => org.members, { onDelete: 'CASCADE' })
  organization: Organization;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @CreateDateColumn()
  createdAt: Date;
}
