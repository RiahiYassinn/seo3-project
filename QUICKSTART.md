# Quick Start - Authentication System

## 🚀 Quick Setup (5 minutes)

### 1. Install Dependencies

```bash
# From root directory
cd client/web
npm install
```

### 2. Configure Environment

Create `client/web/.env.local`:

```env
NEXT_PUBLIC_API_GATEWAY_URL=http://localhost:3000
```

### 3. Start the Development Server

```bash
npm run dev
```

The client will start on `http://localhost:3001`

## 🎨 Available Pages

- **Home:** `http://localhost:3001/` - Landing page
- **Login:** `http://localhost:3001/auth/login` - User login
- **Register:** `http://localhost:3001/auth/register` - User registration
- **Demo:** `http://localhost:3001/demo` - Animated UI demo
- **Dashboard:** `http://localhost:3001/dashboard` - Protected dashboard (requires login)

## 🧪 Quick Test

1. Open `http://localhost:3001/demo` to see the beautiful animated login UI
2. Click "Sign in" to be redirected to the actual login page
3. Go to register: `http://localhost:3001/auth/register`
4. Create an account with:
   - Name: Test User
   - Email: test@example.com
   - Password: password123
5. You'll be automatically logged in and redirected to the dashboard
6. Click "Logout" to logout

## 📦 What Was Installed

### NPM Packages Added:

- `motion` - Animation library for smooth UI animations
- `tailwind-merge` - Utility for merging Tailwind CSS classes

### Files Created:

#### Components:

- `/src/components/ui/modern-animated-sign-in.tsx` - Animated auth components

#### Pages:

- `/src/app/auth/login/page.tsx` - Login page
- `/src/app/auth/register/page.tsx` - Registration page
- `/src/app/demo/page.tsx` - Demo page

#### Utils:

- `/src/lib/utils.ts` - Utility functions (cn function for className merging)

#### Updated Files:

- `/src/app/page.tsx` - Landing page with auth navigation
- `/src/app/dashboard/page.tsx` - Added logout functionality
- `/src/lib/api.ts` - Enhanced with token refresh logic
- `/src/app/globals.css` - Added CSS variables and animations
- `/tailwind.config.js` - Added custom animations and theme

## 🎯 Key Features

✅ Animated login/register forms with beautiful UI  
✅ Dark mode support  
✅ Form validation with error messages  
✅ Password visibility toggle  
✅ Loading states  
✅ Automatic token refresh  
✅ Protected routes  
✅ Logout functionality  
✅ Responsive design

## 🔧 Backend Setup (If not running)

The authentication requires backend services to be running:

### Option 1: Docker (Recommended)

```bash
# From root directory
docker-compose up -d
```

### Option 2: Manual

```bash
# Terminal 1 - API Gateway
cd api-gateway
npm install
npm run dev

# Terminal 2 - Developer Service
cd services/developer-service
npm install
npm run dev
```

## 🎨 Customization

### Change Theme Colors

Edit `client/web/src/app/globals.css`:

```css
:root {
  --background: hsl(0, 0%, 100%);
  --foreground: hsl(0, 0%, 0%);
  --skeleton: hsl(0, 0%, 90%);
  /* ... customize colors */
}
```

### Change Animations

Edit `client/web/tailwind.config.js`:

```js
animation: {
  ripple: "ripple 2s ease calc(var(--i, 0) * 0.2s) infinite",
  orbit: "orbit calc(var(--duration) * 1s) linear infinite",
}
```

### Change Form Fields

Edit the form fields in auth pages:

```typescript
// client/web/src/app/auth/register/page.tsx
const formFields = {
  header: "Create an account",
  fields: [
    // Add or modify fields here
  ],
};
```

## 🐛 Common Issues

### Issue: "Cannot find module 'motion/react'"

**Solution:** Run `npm install` in the `client/web` directory

### Issue: "API calls failing"

**Solution:** Ensure backend services are running and environment variable is set correctly

### Issue: "Animations not working"

**Solution:** Clear browser cache and restart the dev server

### Issue: "Dark mode not working"

**Solution:** Add the `dark` class to the `<html>` tag or configure your dark mode toggle

## 📚 Component Usage Examples

### Using AnimatedForm

```tsx
import { AnimatedForm } from "@/components/ui/modern-animated-sign-in";

<AnimatedForm
  header="Welcome"
  subHeader="Please sign in"
  fields={[
    {
      label: "Email",
      type: "email",
      placeholder: "Enter email",
      onChange: (e) => setEmail(e.target.value),
    },
  ]}
  submitButton="Submit"
  onSubmit={handleSubmit}
/>;
```

### Using TechOrbitDisplay

```tsx
import { TechOrbitDisplay } from "@/components/ui/modern-animated-sign-in";

<TechOrbitDisplay
  iconsArray={
    [
      /* icon configs */
    ]
  }
  text="Your App Name"
/>;
```

### Using Auth Store

```tsx
import { useAuthStore } from "@/lib/store";

function MyComponent() {
  const { user, setAuth, logout } = useAuthStore();

  // Access user data
  console.log(user?.email);

  // Logout
  logout();
}
```

## 🎉 Next Steps

1. **Customize the UI** - Modify colors, animations, and layouts
2. **Add More Features** - Password reset, email verification, OAuth
3. **Enhance Security** - Implement 2FA, stronger password policies
4. **Add Tests** - Write unit and integration tests
5. **Deploy** - Deploy to production with proper environment variables

## 📖 Full Documentation

See `/docs/authentication.md` for comprehensive documentation including:

- Architecture details
- API endpoints
- Security considerations
- Troubleshooting guide
- Production deployment tips

## 💡 Tips

- The demo page is great for showing off the UI to clients
- All forms have built-in validation
- Token refresh is automatic - users won't be logged out unexpectedly
- The UI components are fully customizable via Tailwind CSS classes
- Dark mode works automatically based on system preferences

---

**Built with:** Next.js 14, TypeScript, Tailwind CSS, Motion (Framer Motion), Zustand

For issues or questions, refer to `/docs/authentication.md` or check the codebase.
