import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type JwtPayload = {
  sub: string;
  email: string;
  firstName: string;
  lastName: string;
  orgIds?: string[];
  defaultOrgId?: string | null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService) {
    const jwtSecret = configService.get<string>('JWT_SECRET');
    
    if (!jwtSecret) {
      throw new Error('JWT_SECRET is not defined in environment variables');
    }
    
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  async validate(payload: JwtPayload) {
    return { 
      userId: payload.sub, 
      email: payload.email,
      firstName: payload.firstName,
      lastName: payload.lastName,
      orgIds: payload.orgIds || [],
      defaultOrgId: payload.defaultOrgId ?? null,
    };
  }
}
