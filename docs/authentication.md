# Authentication Implementation Guide

## Overview

This document describes the complete authentication implementation for the SEO3 Developer Platform, including registration, login, and logout functionalities.

## Architecture

The authentication system follows a microservices architecture:

```
Client (Next.js) → API Gateway (NestJS) → Developer Service (NestJS) → PostgreSQL
                                ↓
                              Kafka
```

## Components Implemented

### Backend

#### 1. API Gateway (`api-gateway/`)

- **Auth Controller** (`src/modules/auth/auth.controller.ts`)
  - `POST /auth/register` - User registration
  - `POST /auth/login` - User login
  - `POST /auth/refresh` - Refresh access token
  - `POST /auth/logout` - User logout

- **Auth Service** (`src/modules/auth/auth.service.ts`)
  - Communicates with Developer Service via Kafka
  - Generates JWT tokens
  - Handles token refresh logic

- **Auth Module** (`src/modules/auth/auth.module.ts`)
  - Configured with JWT and Kafka client

#### 2. Developer Service (`services/developer-service/`)

- **Auth Controller** (`src/modules/auth/auth.controller.ts`)
  - Message pattern handlers for `auth.register` and `auth.login`

- **Auth Service** (`src/modules/auth/auth.service.ts`)
  - Password hashing with bcrypt
  - User validation
  - Duplicate email checking

- **Developer Entity** (`src/modules/developer/entities/developer.entity.ts`)
  - User data model in PostgreSQL

### Frontend

#### 1. Components (`client/web/src/components/ui/`)

- **modern-animated-sign-in.tsx** - Comprehensive auth UI components:
  - `Input` - Animated input field with hover effects
  - `BoxReveal` - Reveal animation wrapper
  - `AnimatedForm` - Form with validation
  - `AuthTabs` - Auth page layout
  - `Ripple` - Background animation
  - `TechOrbitDisplay` - Orbiting icons display

#### 2. Pages (`client/web/src/app/`)

- **auth/login/page.tsx** - Login page
- **auth/register/page.tsx** - Registration page
- **dashboard/page.tsx** - Protected dashboard with logout
- **demo/page.tsx** - Demo page showing the animated login UI
- **page.tsx** - Landing page with navigation

#### 3. Services & State

- **lib/api.ts** - Axios instance with interceptors for:
  - Adding auth tokens to requests
  - Automatic token refresh on 401 errors
  - Error handling

- **lib/store.ts** - Zustand store for auth state:
  - User data
  - Token management
  - Login/logout actions

- **lib/utils.ts** - Utility functions (cn for className merging)

#### 4. Styling

- **globals.css** - CSS variables for light/dark themes, animations
- **tailwind.config.js** - Extended with custom animations and colors

## Features

### ✅ Implemented

1. **User Registration**
   - Email and password validation
   - Duplicate email checking
   - Password hashing (bcrypt)
   - Automatic login after registration

2. **User Login**
   - Email/password authentication
   - JWT token generation
   - Refresh token support
   - Error handling

3. **User Logout**
   - Token invalidation
   - Local storage cleanup
   - Redirect to login page

4. **Token Management**
   - Access token (7 days)
   - Refresh token (30 days)
   - Automatic token refresh
   - Secure storage in localStorage

5. **UI/UX**
   - Animated login/register forms
   - Modern, responsive design
   - Dark mode support
   - Form validation with error messages
   - Password visibility toggle
   - Loading states

6. **Security**
   - JWT authentication
   - Password hashing
   - CORS protection
   - Rate limiting (configured in API Gateway)

## Setup Instructions

### Prerequisites

- Node.js 18+
- PostgreSQL
- Kafka (for microservices communication)

### Environment Variables

#### API Gateway (`.env` in root)

```env
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=7d
KAFKA_BROKERS=localhost:29092
```

#### Developer Service (use same `.env`)

```env
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=seo3_dev
JWT_SECRET=your-secret-key-change-in-production
KAFKA_BROKERS=localhost:29092
```

#### Client (`.env.local` in `client/web/`)

```env
NEXT_PUBLIC_API_GATEWAY_URL=http://localhost:3000
```

### Installation

1. **Install dependencies for all services:**

```bash
# From root directory
npm install

# Or install individually
cd api-gateway && npm install
cd ../services/developer-service && npm install
cd ../client/web && npm install
```

2. **Database Setup:**

```bash
# The database will be auto-created if you're using Docker
# Or manually create the database:
createdb seo3_dev
```

3. **Start services:**

Using Docker Compose (recommended):

```bash
docker-compose up -d
```

Or manually:

```bash
# Terminal 1 - Start Kafka (if using Docker)
docker-compose up -d kafka zookeeper

# Terminal 2 - API Gateway
cd api-gateway
npm run dev

# Terminal 3 - Developer Service
cd services/developer-service
npm run dev

# Terminal 4 - Client
cd client/web
npm run dev
```

### Testing the Authentication Flow

1. **View Demo:**
   - Navigate to `http://localhost:3001/demo`
   - See the animated login UI

2. **Register:**
   - Navigate to `http://localhost:3001/auth/register`
   - Fill in: Name, Email, Username (optional), Password
   - Click "Sign up"
   - You'll be redirected to dashboard

3. **Login:**
   - Navigate to `http://localhost:3001/auth/login`
   - Enter email and password
   - Click "Sign in"
   - You'll be redirected to dashboard

4. **Logout:**
   - From dashboard, click "Logout" button
   - You'll be logged out and redirected to login

## API Endpoints

### Registration

```http
POST /auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "username": "johndoe",
  "password": "password123"
}
```

**Response:**

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "uuid",
    "email": "john@example.com",
    "name": "John Doe",
    "username": "johndoe"
  }
}
```

### Login

```http
POST /auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "password123"
}
```

**Response:** Same as registration

### Refresh Token

```http
POST /auth/refresh
Content-Type: application/json

{
  "refresh_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response:**

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

### Logout

```http
POST /auth/logout
Authorization: Bearer <access_token>
```

**Response:**

```json
{
  "message": "Logged out successfully"
}
```

## Client Usage

### Using the Auth Store

```typescript
import { useAuthStore } from "@/lib/store";

function MyComponent() {
  const { user, token, setAuth, logout } = useAuthStore();

  // Check if user is logged in
  if (user) {
    console.log("User:", user.name);
  }

  // Logout
  const handleLogout = () => {
    logout();
    router.push("/auth/login");
  };
}
```

### Making Authenticated Requests

```typescript
import api from "@/lib/api";

// The api instance automatically adds the auth token
const response = await api.get("/developer/profile");
const data = response.data;
```

## File Structure

```
seo3-project/
├── api-gateway/
│   └── src/modules/auth/
│       ├── auth.controller.ts
│       ├── auth.service.ts
│       ├── auth.module.ts
│       ├── dto/
│       └── strategies/
├── services/
│   └── developer-service/
│       └── src/modules/
│           ├── auth/
│           │   ├── auth.controller.ts
│           │   ├── auth.service.ts
│           │   └── auth.module.ts
│           └── developer/
│               ├── developer.service.ts
│               └── entities/
│                   └── developer.entity.ts
└── client/web/
    └── src/
        ├── app/
        │   ├── auth/
        │   │   ├── login/page.tsx
        │   │   └── register/page.tsx
        │   ├── dashboard/page.tsx
        │   ├── demo/page.tsx
        │   ├── page.tsx
        │   └── globals.css
        ├── components/
        │   └── ui/
        │       └── modern-animated-sign-in.tsx
        └── lib/
            ├── api.ts
            ├── store.ts
            └── utils.ts
```

## Troubleshooting

### Issue: "Connection refused" errors

**Solution:** Ensure Kafka is running and accessible at the specified broker address.

### Issue: Database connection errors

**Solution:** Check PostgreSQL is running and environment variables are correct.

### Issue: JWT token errors

**Solution:** Ensure JWT_SECRET is set and is the same across API Gateway and Developer Service.

### Issue: CORS errors

**Solution:** Configure CORS in API Gateway's main.ts if needed.

## Next Steps

To enhance the authentication system:

1. **Email Verification** - Add email verification flow
2. **Password Reset** - Implement forgot password functionality
3. **OAuth Integration** - Add Google, GitHub login
4. **2FA** - Two-factor authentication
5. **Session Management** - Track active sessions
6. **Rate Limiting** - Enhance brute force protection
7. **Audit Logging** - Track authentication events

## Security Considerations

1. **JWT Secrets:** Use strong, unique secrets in production
2. **HTTPS:** Always use HTTPS in production
3. **Token Storage:** Current implementation uses localStorage (consider httpOnly cookies for production)
4. **Password Policy:** Implement stronger password requirements
5. **Rate Limiting:** Configure stricter rate limits
6. **Input Validation:** All inputs are validated, but add additional sanitization
7. **SQL Injection:** Using TypeORM protects against SQL injection
8. **XSS Protection:** React protects against XSS by default

## Dependencies Added

### Client

- `motion` - Animation library (framer-motion successor)
- `tailwind-merge` - Merge Tailwind classes
- `clsx` - Conditional classnames (already present)
- `lucide-react` - Icons (already present)

### Backend

All authentication dependencies were already present in the project.

## Maintenance

### Updating JWT Secret

1. Update `.env` file
2. Restart all services
3. All existing tokens will be invalidated

### Database Migrations

Using TypeORM's synchronize feature for development. For production:

1. Set `synchronize: false`
2. Use TypeORM migrations
3. Run migrations before deployment
