import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from './entities/organization.entity';
import { OrganizationMember } from './entities/organization-member.entity';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { AddOrganizationMemberDto } from './dto/add-organization-member.dto';
import { User } from '../users/entities/user.entity';

@Injectable()
export class OrganizationService {
  constructor(
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
    @InjectRepository(OrganizationMember)
    private readonly memberRepository: Repository<OrganizationMember>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async createOrganization(input: CreateOrganizationDto) {
    const slug = this.normalizeSlug(input.slug || input.name);
    if (!slug) {
      throw new BadRequestException('Invalid organization name or slug');
    }

    const existing = await this.organizationRepository.findOne({
      where: { slug },
    });
    if (existing) {
      throw new BadRequestException('Organization slug already exists');
    }

    const organization = this.organizationRepository.create({
      name: input.name.trim(),
      slug,
      isActive: true,
    });
    const saved = await this.organizationRepository.save(organization);

    if (input.ownerUserId) {
      const user = await this.userRepository.findOne({
        where: { id: input.ownerUserId },
      });
      if (!user) {
        throw new NotFoundException(
          `User with ID ${input.ownerUserId} not found`,
        );
      }
      await this.memberRepository.save({
        organization: saved,
        user,
        role: 'owner',
      });
    }

    return saved;
  }

  async addMember(organizationId: string, input: AddOrganizationMemberDto) {
    const organization = await this.organizationRepository.findOne({
      where: { id: organizationId },
    });
    if (!organization) {
      throw new NotFoundException(`Organization ${organizationId} not found`);
    }

    const user = await this.userRepository.findOne({
      where: { id: input.userId },
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${input.userId} not found`);
    }

    const existing = await this.memberRepository.findOne({
      where: { organization: { id: organizationId }, user: { id: input.userId } },
    });
    if (existing) {
      throw new BadRequestException('User is already a member');
    }

    const created = await this.memberRepository.save({
      organization,
      user,
      role: input.role,
    });

    const hydrated = await this.memberRepository.findOne({
      where: { id: created.id },
      relations: ['user', 'organization'],
    });
    if (!hydrated) {
      throw new NotFoundException('Failed to load created member');
    }

    return this.serializeMember(hydrated);
  }

  async listMembers(organizationId: string) {
    const members = await this.memberRepository.find({
      where: { organization: { id: organizationId } },
      relations: ['user', 'organization'],
      order: { createdAt: 'DESC' },
    });
    return members.map((member) => this.serializeMember(member));
  }

  async isMember(userId: string, organizationId: string): Promise<boolean> {
    const member = await this.getMembership(userId, organizationId);
    return Boolean(member);
  }

  async getMemberRole(
    userId: string,
    organizationId: string,
  ): Promise<string | null> {
    const member = await this.getMembership(userId, organizationId);
    return member?.role ?? null;
  }

  async assertUserHasAnyRole(
    userId: string,
    organizationId: string,
    allowedRoles: string[],
  ) {
    if (!userId) {
      throw new ForbiddenException('Authentication required');
    }
    const role = await this.getMemberRole(userId, organizationId);
    const normalized = role ? role.toLowerCase() : null;
    const allowed = allowedRoles.map((item) => item.toLowerCase());
    if (!normalized || !allowed.includes(normalized)) {
      throw new ForbiddenException('Insufficient organization role');
    }
  }

  async listUserOrganizations(userId: string) {
    return this.memberRepository.find({
      where: { user: { id: userId } },
      relations: ['organization'],
      order: { createdAt: 'DESC' },
    });
  }

  private normalizeSlug(value: string) {
    const slug = value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    return slug || null;
  }

  private getMembership(userId: string, organizationId: string) {
    return this.memberRepository.findOne({
      where: { organization: { id: organizationId }, user: { id: userId } },
    });
  }

  private serializeMember(member: OrganizationMember) {
    return {
      id: member.id,
      role: member.role,
      createdAt: member.createdAt,
      user: member.user
        ? {
            id: member.user.id,
            firstName: member.user.firstName,
            lastName: member.user.lastName,
            email: member.user.email,
            isActive: member.user.isActive,
          }
        : null,
      organization: member.organization
        ? {
            id: member.organization.id,
            name: member.organization.name,
            slug: member.organization.slug,
          }
        : null,
    };
  }
}
