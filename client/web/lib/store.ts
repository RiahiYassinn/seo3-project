import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { authAPI } from './auth'

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
  hasHydrated: boolean
  setHasHydrated: (value: boolean) => void
  setAuth: (user: User, token: string) => void
  logout: (logoutAllDevices?: boolean) => Promise<void>
  updateUser: (userData: Partial<User>) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      hasHydrated: false,
      setHasHydrated: (value) => set({ hasHydrated: value }),
      setAuth: (user, token) => {
        localStorage.setItem('access_token', token)
        set({ user })
      },
      logout: async (logoutAllDevices = false) => {
        try {
          const refreshToken = localStorage.getItem('refresh_token')
          if (refreshToken) {
            await authAPI.logout(refreshToken, logoutAllDevices)
          }
        } catch (error) {
          console.error('Logout error:', error)
        } finally {
          localStorage.removeItem('access_token')
          localStorage.removeItem('refresh_token')
          set({ user: null })
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
      partialize: (state) => ({ user: state.user }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    }
  )
)