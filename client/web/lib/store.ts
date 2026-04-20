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
  avatar?: string | null
  is_first_login?: boolean
  is_mentor?: boolean
}

interface AuthState {
  user: User | null
  hasHydrated: boolean
  setHasHydrated: (value: boolean) => void
  setAuth: (user: User) => void
  logout: (logoutAllDevices?: boolean) => Promise<void>
  updateUser: (userData: Partial<User>) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      hasHydrated: false,
      setHasHydrated: (value) => set({ hasHydrated: value }),
      setAuth: (user) => {
        set({ user, hasHydrated: true })
      },
      logout: async (logoutAllDevices = false) => {
        try {
          await authAPI.logout(undefined, logoutAllDevices)
        } catch (error) {
          console.error('Logout error:', error)
        } finally {
          set({ user: null })
        }
      },
      updateUser: (userData) => {
        const currentUser = get().user
        set({ user: currentUser ? { ...currentUser, ...userData } : (userData as User) })
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ user: state.user }),
    }
  )
)
