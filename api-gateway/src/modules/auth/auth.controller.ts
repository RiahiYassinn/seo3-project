import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
  Res,
  Ip,
  Headers
} from '@nestjs/common';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { RefreshTokenGuard } from './guards/refresh-token.guard';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import {
  RegisterDto,
  LoginDto,
  RefreshTokenDto,
  LogoutDto,
  VerifyEmailDto,
  ResendVerificationDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  ChangePasswordDto,
} from './dto/auth.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  private readonly isProduction = this.configService.get('NODE_ENV') === 'production';
  private readonly accessTokenMaxAge = 15 * 60 * 1000;
  private readonly refreshTokenMaxAge = 7 * 24 * 60 * 60 * 1000;

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) { }

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User successfully registered' })
  @ApiResponse({ status: 400, description: 'Bad request - validation error' })
  @ApiResponse({ status: 409, description: 'Email or username already exists' })
  async register(
    @Body() registerDto: RegisterDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string
  ) {
    return this.authService.register(registerDto, { ip, userAgent });
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(LocalAuthGuard)
  @ApiOperation({ summary: 'Login user' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(
    @Body() _loginDto: LoginDto,
    @Req() req,
    @Res({ passthrough: true }) res: Response,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string
  ) {
    const result = await this.authService.login(req.user, {
      ip,
      userAgent,
      deviceInfo: req.headers['x-device-info']
    });

    this.setAuthCookies(res, result.access_token, result.refresh_token);
    return this.toSessionResponse(result);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RefreshTokenGuard)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'Tokens refreshed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async refreshTokens(
    @Req() req,
    @Body() refreshTokenDto: RefreshTokenDto,
    @Res({ passthrough: true }) res: Response,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string
  ) {
    const result = await this.authService.refreshTokens(req.user, {
      ip,
      userAgent,
      deviceInfo: req.headers['x-device-info'],
      refreshToken: refreshTokenDto.refresh_token || req.user?.refreshToken || req.cookies?.refresh_token
    });

    this.setAuthCookies(res, result.access_token, result.refresh_token);
    return this.toSessionResponse(result);
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user' })
  @ApiResponse({ status: 200, description: 'Current user returned successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getCurrentUser(@Req() req) {
    return this.authService.getCurrentUser(req.user.id);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout user' })
  @ApiResponse({ status: 200, description: 'Logout successful' })
  async logout(
    @Body() logoutDto: LogoutDto,
    @Req() req,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.clearAuthCookies(res);

    return this.authService.logout(
      req.user?.id,
      logoutDto.refresh_token || req.cookies?.refresh_token,
      logoutDto.logout_all_devices || false
    );
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify email address' })
  @ApiResponse({ status: 200, description: 'Email verified successfully' })
  async verifyEmail(@Body() verifyEmailDto: VerifyEmailDto) {
    return this.authService.verifyEmail(verifyEmailDto.token);
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend verification email' })
  async resendVerification(@Body() resendDto: ResendVerificationDto) {
    return this.authService.resendVerification(resendDto.email);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset' })
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto.email);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password' })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(
      resetPasswordDto.token,
      resetPasswordDto.new_password
    );
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change password for authenticated user' })
  async changePassword(
    @Req() req,
    @Res({ passthrough: true }) res: Response,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    this.clearAuthCookies(res);
    return this.authService.changePassword(req.user.id, changePasswordDto.new_password);
  }

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Initiate Google OAuth login' })
  googleAuth() {
    // Guard redirects to Google
  }

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Google OAuth callback' })
  async googleAuthCallback(@Req() req, @Res() res: Response) {
    try {
      const result = await this.authService.googleLogin(req.user);
      const frontendUrl = this.configService.get('FRONTEND_URL', 'http://localhost:3001');
      this.setAuthCookies(res, result.access_token, result.refresh_token);
      res.redirect(`${frontendUrl}/auth/google/callback`);
    } catch (error) {
      const frontendUrl = this.configService.get('FRONTEND_URL', 'http://localhost:3001');
      res.redirect(`${frontendUrl}/auth/google/callback?error=${encodeURIComponent(error.message)}`);
    }
  }

  private setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
    res.cookie('access_token', accessToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.isProduction,
      maxAge: this.accessTokenMaxAge,
      path: '/',
    });

    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.isProduction,
      maxAge: this.refreshTokenMaxAge,
      path: '/api/v1/auth',
    });
  }

  private clearAuthCookies(res: Response) {
    res.clearCookie('access_token', {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.isProduction,
      path: '/',
    });

    res.clearCookie('refresh_token', {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.isProduction,
      path: '/api/v1/auth',
    });
  }

  private toSessionResponse(result: {
    token_type: string;
    expires_in: number;
    user: {
      id: string;
      email: string;
      username: string;
      first_name: string;
      last_name: string;
      role: string;
      is_first_login?: boolean;
    };
  }) {
    return {
      token_type: result.token_type,
      expires_in: result.expires_in,
      user: result.user,
    };
  }
}
