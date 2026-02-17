import { Injectable, UnauthorizedException } from '@nestjs/common';
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
    const hashedPassword = await bcrypt.hash(registerDto.password, 10);
    const developer = await this.developerService.create({
      ...registerDto,
      password: hashedPassword,
    });
    
    const { password, ...result } = developer as any;
    return result;
  }

  async validateUser(email: string, password: string): Promise<any> {
    const developer = await this.developerService.findByEmail(email);
    if (developer && await bcrypt.compare(password, developer.password)) {
      const { password, ...result } = developer as any;
      return result;
    }
    return null;
  }

  async login(loginDto: any) {
    const developer = await this.validateUser(loginDto.email, loginDto.password);
    if (!developer) {
      throw new UnauthorizedException('Invalid credentials');
    }
    
    const payload = { email: developer.email, sub: developer.id };
    return {
      access_token: this.jwtService.sign(payload),
      user: developer,
    };
  }
}
