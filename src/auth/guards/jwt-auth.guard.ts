import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
//use for future guarding of route 
export class JwtAuthGuard extends AuthGuard('jwt') {}