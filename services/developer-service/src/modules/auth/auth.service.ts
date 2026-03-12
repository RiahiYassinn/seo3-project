import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { DeveloperService } from '../developer/developer.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly developerService: DeveloperService,
  ) {}

  async register(registerDto: any) {
    const existingDeveloper = await this.developerService.findByEmail(registerDto.email);
    if (existingDeveloper) {
      throw new ConflictException('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 10);
    const developer = await this.developerService.createUser({
      email: registerDto.email,
      username: registerDto.username,
      firstName: registerDto.first_name ?? registerDto.firstName ?? '',
      lastName: registerDto.last_name ?? registerDto.lastName ?? '',
      password: hashedPassword,
    });

    const { passwordHash, ...result } = developer as any;
    return result;
  }

  async validateUser(email: string, password: string): Promise<any> {
    const developer = await this.developerService.findByEmail(email);
    if (developer && await bcrypt.compare(password, developer.passwordHash)) {
      const { passwordHash, ...result } = developer as any;
      return result;
    }
    return null;
  }

  async login(loginDto: any) {
    const developer = await this.validateUser(loginDto.email, loginDto.password);
    if (!developer) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return developer;
  }
}

