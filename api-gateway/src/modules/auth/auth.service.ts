import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { LoginDto, RegisterDto, RefreshTokenDto } from './dto';

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  async register(registerDto: RegisterDto) {
    // TODO: Implement communication with Developer Service
    // This will send a message to Developer Service microservice
    return {
      message: 'Registration endpoint - to be connected to Developer Service',
      data: registerDto,
    };
  }

  async login(loginDto: LoginDto) {
    // TODO: Implement communication with Developer Service
    // This will validate credentials and return JWT tokens
    const payload = { email: loginDto.email, sub: 'user-id' };
    
    return {
      access_token: this.jwtService.sign(payload),
      refresh_token: this.jwtService.sign(payload, { expiresIn: '30d' }),
      user: {
        email: loginDto.email,
        // Additional user data from Developer Service
      },
    };
  }

  async refresh(refreshTokenDto: RefreshTokenDto) {
    try {
      const payload = this.jwtService.verify(refreshTokenDto.refresh_token);
      const newPayload = { email: payload.email, sub: payload.sub };
      
      return {
        access_token: this.jwtService.sign(newPayload),
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
}
