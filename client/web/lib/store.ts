import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface User {
  id: string
  email: string
  username: string
  first_name: string
  last_name: string
  role: string
}

interface AuthState {
  user: User | null
  token: string | null
  setAuth: (user: User, token: string) => void
  logout: (logoutAllDevices?: boolean) => Promise<void>
  updateUser: (userData: Partial<User>) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      setAuth: (user, token) => {
        localStorage.setItem('access_token', token)
        set({ user, token })
      },
      logout: async (logoutAllDevices = false) => {
        try {
          const refreshToken = localStorage.getItem('refresh_token')
          if (refreshToken) {
            // Call logout API
            await fetch(`${process.env.NEXT_PUBLIC_API_GATEWAY_URL}/api/v1/auth/logout`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                refresh_token: refreshToken,
                logout_all_devices: logoutAllDevices 
              })
            })
          }
        } catch (error) {
          console.error('Logout error:', error)
        } finally {
          // Always clear local storage
          localStorage.removeItem('access_token')
          localStorage.removeItem('refresh_token')
          set({ user: null, token: null })
        }
      },
      updateUser: (userData) => {
        const currentUser = get().user
        if (currentUser) {
          set({ user: { ...currentUser, ...userData } })
        }
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ user: state.user }), // Don't persist token
    }
  )
)