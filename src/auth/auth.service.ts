import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { LoginUserDto } from '../users/dtos/login-user.dto';
import { OrganizationService } from '../organization/organization.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private organizationService: OrganizationService,
  ) {}

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.usersService.findOneByEmail(email);
    if (user && await user.validatePassword(password)) {
      return user;
    }
    return null;
  }

  async login(loginUserDto: LoginUserDto) {
    const user = await this.validateUser(loginUserDto.email, loginUserDto.password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const memberships = await this.organizationService.listUserOrganizations(user.id);
    const organizations = memberships.map((member) => ({
      id: member.organization.id,
      name: member.organization.name,
      slug: member.organization.slug,
      role: member.role,
    }));
    const defaultOrgId = organizations.length ? organizations[0].id : null;

    const payload = { 
      sub: user.id, 
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      orgIds: organizations.map((org) => org.id),
      defaultOrgId,
    };
    
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        organizations,
        defaultOrgId,
      }
    };
  }
}
