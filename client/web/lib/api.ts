import axios from 'axios'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_GATEWAY || 'http://localhost:3006'

const syncStoredUser = (user: unknown) => {
  if (typeof window === 'undefined' || !user) {
    return
  }

  const rawStorage = localStorage.getItem('auth-storage')
  if (!rawStorage) {
    return
  }

  try {
    const parsedStorage = JSON.parse(rawStorage)
    localStorage.setItem(
      'auth-storage',
      JSON.stringify({
        ...parsedStorage,
        state: {
          ...parsedStorage.state,
          user,
        },
      })
    )
  } catch (storageError) {
    console.error('Failed to sync stored user:', storageError)
  }
}

export const api = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor for adding auth token
api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      // Add device info for better tracking
      config.headers['x-device-info'] = `${navigator.platform} - ${navigator.userAgent}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor for handling errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    // Handle token refresh
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/refresh') &&
      !originalRequest.url?.includes('/auth/login') &&
      !originalRequest.url?.includes('/auth/logout')
    ) {
      originalRequest._retry = true

      try {
        const response = await axios.post(
          `${API_BASE_URL}/api/v1/auth/refresh`,
          {},
          { withCredentials: true }
        )

        const { user } = response.data
        syncStoredUser(user)
        return api(originalRequest)
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError)
        localStorage.removeItem('auth-storage')
        if (typeof window !== 'undefined') {
          window.location.href = '/login'
        }
      }
    }
    
    // Handle specific error status codes
    if (error.response?.status === 403) {
      // Forbidden - user doesn't have permission
      console.error('Access forbidden:', error.response.data)
    } else if (error.response?.status === 429) {
      // Rate limited
      console.error('Rate limited:', error.response.data)
    }
    
    return Promise.reject(error)
  }
)

export default api
