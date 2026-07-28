import api from './api'

export interface LoginCredentials {
  username_or_email: string  // Changed from 'email' to match backend
  password: string
}

export interface RegisterData {
  email: string
  username: string
  first_name: string  // Changed from 'name' to 'first_name' and 'last_name'
  last_name: string
  password: string
}

export interface AuthResponse {
  token_type: string
  expires_in: number
  user: {
    id: string
    email: string
    username: string
    first_name: string
    last_name: string
    role: string
    avatar?: string | null
    is_first_login?: boolean
    is_mentor?: boolean
  }
}

export interface UserProfile {
  id: string
  email: string
  username: string
  first_name: string
  last_name: string
  role: string
  avatar?: string | null
  is_first_login?: boolean
  is_mentor?: boolean
}

export interface MessageResponse {
  message: string
}

export interface MentorAvailabilityResponse {
  message: string
  user: UserProfile
}

class AuthAPI {
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await api.post('/auth/login', credentials)
    return response.data
  }

  async register(data: RegisterData): Promise<MessageResponse> {
    const response = await api.post('/auth/register', data)
    return response.data
  }

  async refreshToken(): Promise<{ token_type: string; expires_in: number; user: UserProfile }> {
    const response = await api.post('/auth/refresh', {})
    return response.data
  }

  async getCurrentUser(): Promise<UserProfile> {
    const response = await api.get('/auth/me')
    return response.data
  }

  async logout(refreshToken?: string, logoutAllDevices: boolean = false): Promise<{ message: string }> {
    const response = await api.post('/auth/logout', {
      refresh_token: refreshToken,
      logout_all_devices: logoutAllDevices
    })
    return response.data
  }

  async verifyEmail(token: string): Promise<{ message: string }> {
    const response = await api.post('/auth/verify-email', { token })
    return response.data
  }

  async resendVerification(email: string): Promise<{ message: string }> {
    const response = await api.post('/auth/resend-verification', { email })
    return response.data
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    const response = await api.post('/auth/forgot-password', { email })
    return response.data
  }

  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    const response = await api.post('/auth/reset-password', {
      token,
      new_password: newPassword
    })
    return response.data
  }

  async changePassword(newPassword: string): Promise<{ message: string }> {
    const response = await api.post('/auth/change-password', {
      new_password: newPassword
    })
    return response.data
  }

  async updateMentorAvailability(isMentor: boolean): Promise<MentorAvailabilityResponse> {
    const response = await api.patch('/auth/me/mentor-availability', {
      is_mentor: isMentor,
    })
    return response.data
  }

  getGoogleAuthUrl(): string {
    const apiBase = process.env.NEXT_PUBLIC_API_GATEWAY_URL ?? 'http://localhost:3006'
    return `${apiBase}/api/v1/auth/google`
  }
}

export const authAPI = new AuthAPI()
