# devlab - Technical Skill Intelligence System

A modern authentication system built with Next.js, Supabase, and beautiful animated UI components for the devlab platform.

## Features

- Modern landing page with smooth animations
- User registration and login with Supabase Auth
- Responsive navigation bar with user dropdown
- Logout functionality
- Beautiful gradient colors based on Wevioo brand
- Fully responsive design
- TypeScript for type safety

## Getting Started

### 1. Environment Setup

The project uses Supabase for authentication. Update your `.env.local` file with your Supabase credentials:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Supabase Authentication

The authentication system is already configured. Once you add your Supabase credentials, the auth will work automatically.

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Build for Production

```bash
npm run build
```

## Project Structure

```
app/
├── page.tsx              # Landing page
├── login/page.tsx        # Login page
├── register/page.tsx     # Registration page
├── layout.tsx            # Root layout
└── globals.css           # Global styles

components/
├── navbar.tsx            # Navigation with logout dropdown
└── ui/
    ├── modern-animated-sign-in.tsx  # Animated form components
    └── ...                           # Shadcn UI components

lib/
└── supabase.ts           # Supabase client configuration
```

## Color Scheme

The project uses colors inspired by the Wevioo logo:

- Primary: Green/Lime (hsl(84 65% 45%))
- Secondary: Orange (hsl(24 100% 50%))
- Accent: Magenta/Pink (hsl(301 88% 42%))

## Key Components

### Landing Page (/)

- Hero section with animated gradient text
- Feature showcase
- How it works section
- Call-to-action sections

### Login Page (/login)

- Email and password authentication
- Animated form fields with hover effects
- Link to registration page
- Decorative animated icons

### Register Page (/register)

- User registration with email/password
- Password confirmation
- Animated form with validation
- Link to login page

### Navbar

- Logo display
- Navigation links
- User avatar with dropdown menu
- Logout functionality
- Login/Register buttons for unauthenticated users

## Authentication Flow

1. User registers via `/register` page
2. Supabase creates user account
3. User is automatically logged in and redirected to home
4. User avatar appears in navbar with dropdown menu
5. User can logout via dropdown menu

## Technologies Used

- **Next.js 13** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Shadcn UI** - UI components
- **Supabase** - Authentication and database
- **Framer Motion** - Animations
- **Lucide React** - Icons

## Deployment

This project is configured for Netlify deployment with the provided `netlify.toml` configuration.

## Notes

- The project uses "use client" directives for interactive components
- Supabase client is configured with fallback values for build-time
- All pages are fully responsive
- Authentication state is managed globally via Supabase auth
