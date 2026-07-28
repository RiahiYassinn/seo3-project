# Admin Backoffice - User Management System

## Overview

A complete admin dashboard has been created for managing users in your application. The system includes a modern UI with a collapsible sidebar and full CRUD operations for user management.

## What Was Created

### Frontend Components

#### 1. Admin Dashboard Pages

- **Location**: `client/web/app/dashboard/admin/`
- **Files**:
  - `page.tsx` - Redirect handler for admin authentication
  - `users/page.tsx` - Main admin dashboard with user management

#### 2. User Management Table Component

- **Location**: `client/web/components/admin/users-management-table.tsx`
- **Features**:
  - Display all users in a responsive table
  - Search functionality (by email, username, name)
  - Filter by role (Admin, Tech Lead, Developer)
  - Edit user information
  - Delete users with confirmation dialog
  - User statistics dashboard (total users, admins, developers, active today)
  - Role-based badge colors
  - Email verification status indicators

### Backend API

#### 1. Admin Module (API Gateway)

- **Location**: `api-gateway/src/modules/admin/`
- **Files**:
  - `admin.controller.ts` - REST endpoints for admin operations
  - `admin.service.ts` - Business logic and microservice communication
  - `admin.module.ts` - Module configuration
  - `dto/user.dto.ts` - Data transfer objects for user operations
  - `guards/roles.guard.ts` - Authorization guard for admin-only access
  - `guards/jwt-auth.guard.ts` - JWT authentication guard
  - `decorators/roles.decorator.ts` - Custom decorator for role-based access

#### 2. Developer Service Message Handlers

- **Location**: `services/developer-service/src/modules/developer/developer.controller.ts`
- **New Message Patterns**:
  - `get_all_users` - Fetch all users with activity statistics
  - `get_user_by_id` - Get specific user details
  - `admin_create_user` - Create new user (admin only)
  - `admin_update_user` - Update user information
  - `admin_delete_user` - Delete a user
  - `get_user_stats` - Get user statistics (counts by role)
  - `check_refresh_token_revoked` - Check token revocation status

### API Endpoints

All endpoints require admin authentication and are prefixed with `/api/v1/admin`

```
GET    /api/v1/admin/users           # Get all users
GET    /api/v1/admin/users/:id       # Get user by ID
POST   /api/v1/admin/users           # Create new user
PATCH  /api/v1/admin/users/:id       # Update user
DELETE /api/v1/admin/users/:id       # Delete user
GET    /api/v1/admin/stats           # Get user statistics
```

## How to Access

### 1. Create an Admin User

First, you need to create a user with admin role. You can do this by:

**Option A: Update existing user in database**

```sql
UPDATE developers SET role = 'admin' WHERE email = 'your-email@example.com';
```

**Option B: Register through API then update role**

1. Register a new user through `/api/v1/auth/register`
2. Update the user's role to 'admin' in the database

### 2. Login and Navigate

1. Login with your admin credentials at `/login`
2. Navigate to `/dashboard/admin/users`
3. You'll see the full admin dashboard with user management

## Features

### User Statistics Dashboard

- **Total Users**: Shows count of all registered users
- **Admins**: Count of users with admin role
- **Tech Leads**: Count of users with tech_lead role
- **Developers**: Count of users with developer role
- **Active Today**: Users who logged in within last 24 hours

### Search and Filter

- **Search**: Real-time search across email, username, first name, and last name
- **Role Filter**: Dropdown to filter users by role (All, Admin, Tech Lead, Developer)

### User Actions

- **Edit**: Modify user information including role assignment
- **Delete**: Remove users with confirmation dialog
- **View Details**: See full user information including join date and verification status

### User Table Columns

- **User**: Avatar (initials), full name, username
- **Email**: Email address with icon
- **Role**: Color-coded badge (Red=Admin, Purple=Tech Lead, Blue=Developer)
- **Status**: Email verification status (Verified/Pending)
- **Joined**: Registration date
- **Actions**: Dropdown menu with Edit and Delete options

## Security Features

### Role-Based Access Control (RBAC)

- All admin endpoints protected with `@Roles('admin')` decorator
- JWT authentication required for all requests
- RolesGuard validates user role before allowing access
- Only users with 'admin' role can access these endpoints

### Authorization Flow

1. JWT token validated by JwtAuthGuard
2. User role extracted from token payload
3. RolesGuard checks if user has required 'admin' role
4. If authorized, request proceeds; otherwise returns 403 Forbidden

## Dark Mode Support

The dashboard includes built-in dark mode support with:

- Toggle button in header
- Automatic theme persistence
- Smooth transitions between themes
- Full component theming

## Customization

### Adding New User Fields

To add new fields to user management:

1. **Update DTO** (`admin/dto/user.dto.ts`):

```typescript
@ApiProperty({ required: false })
@IsOptional()
@IsString()
newField?: string;
```

2. **Update Table Component** (`components/admin/users-management-table.tsx`):
   Add new column in the table and form inputs in dialogs

3. **Update Backend Handler** (`developer.controller.ts`):
   Include new field in update/create handlers

### Changing Role Colors

Edit the `getRoleBadgeColor` function in `users-management-table.tsx`:

```typescript
const getRoleBadgeColor = (role: string) => {
  switch (role) {
    case "admin":
      return "bg-red-100 text-red-800...";
    // Add your custom colors
  }
};
```

## Testing the Admin Panel

### 1. Backend Tests

```bash
# From api-gateway directory
npm run test

# Test admin endpoints
curl -X GET http://localhost:3006/api/v1/admin/users \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN"
```

### 2. Frontend Development

```bash
# From client/web directory
npm run dev

# Navigate to:
# http://localhost:3001/dashboard/admin/users
```

## Troubleshooting

### "Access Forbidden" Error

- Ensure your user has 'admin' role in the database
- Check JWT token is valid and not expired
- Verify Authorization header is being sent

### Users Not Loading

- Check that both API Gateway and Developer Service are running
- Verify microservice connection (TCP port 3003)
- Check browser console for API errors

### Cannot Update User

- Ensure unique constraint validation on email/username
- Check all required fields are provided
- Verify user ID exists in database

## Next Steps

### Recommended Enhancements

1. **Activity Logs**: Track admin actions (who deleted/modified what)
2. **Bulk Operations**: Select multiple users for bulk delete/role change
3. **User Export**: Export user list to CSV/Excel
4. **Advanced Filters**: Filter by date range, verification status
5. **User Impersonation**: Allow admin to login as any user (with audit trail)
6. **Email Notifications**: Send emails when admin modifies user accounts
7. **Pagination**: Add pagination for large user lists
8. **User Details Modal**: View comprehensive user profile in modal

### Security Enhancements

1. **Audit Trail**: Log all admin actions with timestamp and IP
2. **Multi-Factor Auth**: Require MFA for admin accounts
3. **Session Management**: View and revoke user sessions
4. **IP Whitelisting**: Restrict admin panel to specific IPs

## File Structure Summary

```
client/web/
├── app/
│   └── dashboard/
│       └── admin/
│           ├── page.tsx
│           └── users/
│               └── page.tsx
└── components/
    └── admin/
        └── users-management-table.tsx

api-gateway/src/
├── app.module.ts (updated)
└── modules/
    └── admin/
        ├── admin.module.ts
        ├── admin.controller.ts
        ├── admin.service.ts
        ├── dto/
        │   └── user.dto.ts
        ├── guards/
        │   ├── roles.guard.ts
        │   └── jwt-auth.guard.ts
        └── decorators/
            └── roles.decorator.ts

services/developer-service/src/
└── modules/
    └── developer/
        ├── developer.controller.ts (updated)
        └── developer.service.ts (updated)
```

## Support

If you encounter any issues or need additional features, please check:

1. Ensure all dependencies are installed: `npm install`
2. Restart both backend services after changes
3. Clear browser cache and localStorage if experiencing login issues
4. Check console logs for detailed error messages

---

**Built with**: Next.js 13, TypeScript, Tailwind CSS, shadcn/ui, NestJS, TypeORM
**Authentication**: JWT with Role-Based Access Control
**Responsive**: Works on mobile, tablet, and desktop
