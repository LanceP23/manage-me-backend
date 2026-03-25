import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Organization } from './entities/organization.entity';
import { OrganizationMember } from './entities/organization-member.entity';
import { OrganizationController } from './organization.controller';
import { OrganizationService } from './organization.service';
import { OrgGuard } from './guards/org.guard';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Organization, OrganizationMember, User])],
  controllers: [OrganizationController],
  providers: [OrganizationService, OrgGuard],
  exports: [OrganizationService, OrgGuard],
})
export class OrganizationModule {}
