"use client";
import { useState, ChangeEvent, FormEvent, ReactNode, useEffect } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Ripple,
  AuthTabs,
  TechOrbitDisplay,
} from "@/components/ui/modern-animated-sign-in";
import { authAPI } from "@/lib/auth";
import { useAuthStore } from "@/lib/store";

interface OrbitIcon {
  component: () => ReactNode;
  className: string;
  duration?: number;
  delay?: number;
  radius?: number;
  path?: boolean;
  reverse?: boolean;
}

const iconsArray: OrbitIcon[] = [
  {
    component: () => (
      <Image
        width={100}
        height={100}
        src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/html5/html5-original.svg"
        alt="HTML5"
      />
    ),
    className: "size-[30px] border-none bg-transparent",
    duration: 20,
    delay: 20,
    radius: 100,
    path: false,
    reverse: false,
  },
  {
    component: () => (
      <Image
        width={100}
        height={100}
        src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/css3/css3-original.svg"
        alt="CSS3"
      />
    ),
    className: "size-[30px] border-none bg-transparent",
    duration: 20,
    delay: 10,
    radius: 100,
    path: false,
    reverse: false,
  },
  {
    component: () => (
      <Image
        width={100}
        height={100}
        src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/typescript/typescript-original.svg"
        alt="TypeScript"
      />
    ),
    className: "size-[50px] border-none bg-transparent",
    radius: 210,
    duration: 20,
    path: false,
    reverse: false,
  },
  {
    component: () => (
      <Image
        width={100}
        height={100}
        src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/javascript/javascript-original.svg"
        alt="JavaScript"
      />
    ),
    className: "size-[50px] border-none bg-transparent",
    radius: 210,
    duration: 20,
    delay: 20,
    path: false,
    reverse: false,
  },
  {
    component: () => (
      <Image
        width={100}
        height={100}
        src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/tailwindcss/tailwindcss-original.svg"
        alt="TailwindCSS"
      />
    ),
    className: "size-[30px] border-none bg-transparent",
    duration: 20,
    delay: 20,
    radius: 150,
    path: false,
    reverse: true,
  },
  {
    component: () => (
      <Image
        width={100}
        height={100}
        src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/nextjs/nextjs-original.svg"
        alt="Nextjs"
      />
    ),
    className: "size-[30px] border-none bg-transparent",
    duration: 20,
    delay: 10,
    radius: 150,
    path: false,
    reverse: true,
  },
  {
    component: () => (
      <Image
        width={100}
        height={100}
        src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/react/react-original.svg"
        alt="React"
      />
    ),
    className: "size-[50px] border-none bg-transparent",
    radius: 270,
    duration: 20,
    path: false,
    reverse: true,
  },
  {
    component: () => (
      <Image
        width={100}
        height={100}
        src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/figma/figma-original.svg"
        alt="Figma"
      />
    ),
    className: "size-[50px] border-none bg-transparent",
    radius: 270,
    duration: 20,
    delay: 60,
    path: false,
    reverse: true,
  },
  {
    component: () => (
      <Image
        width={100}
        height={100}
        src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/git/git-original.svg"
        alt="Git"
      />
    ),
    className: "size-[50px] border-none bg-transparent",
    radius: 320,
    duration: 20,
    delay: 20,
    path: false,
    reverse: false,
  },
];

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [formData, setFormData] = useState({
    username_or_email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const urlError = searchParams.get("error");
    if (urlError) setError(decodeURIComponent(urlError));
  }, [searchParams]);

  const handleInputChange = (
    event: ChangeEvent<HTMLInputElement>,
    name: "username_or_email" | "password",
  ) => {
    const value = event.target.value;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setError("");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await authAPI.login(formData);

      const { user } = response;

      // Store user data; tokens are handled with HttpOnly cookies
      setAuth(user);

      if (user.is_first_login) {
        router.push("/reset-password?first_login=1");
        return;
      }

      // Redirect to role-based dashboard
      router.push("/dashboard");
    } catch (err: any) {
      setError(
        err.response?.data?.message || "Login failed. Please try again.",
      );
      console.error("Login error:", err);
    } finally {
      setLoading(false);
    }
  };

  const goToRegister = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    router.push("/register");
  };

  const formFields = {
    header: "Welcome back",
    subHeader: "Sign in to your account to continue",
    fields: [
      {
        label: "Email or Username",
        required: true,
        type: "text" as const,
        placeholder: "Enter your email or username",
        onChange: (event: ChangeEvent<HTMLInputElement>) =>
          handleInputChange(event, "username_or_email"),
      },
      {
        label: "Password",
        required: true,
        type: "password" as const,
        placeholder: "Enter your password",
        onChange: (event: ChangeEvent<HTMLInputElement>) =>
          handleInputChange(event, "password"),
      },
    ],
    submitButton: loading ? "Signing in..." : "Sign in",
    // textVariantButton: "Don't have an account? Sign up",
  };

  return (
    <section className="flex max-lg:justify-center h-screen bg-background ">
      {/* Left Side - Logo-inspired gradient */}
      <span className="flex flex-col justify-center w-1/2 max-lg:hidden overflow-hidden bg-gradient-to-br ">
        <Ripple mainCircleSize={200} />
        <TechOrbitDisplay iconsArray={iconsArray} text="SEO3 Platform" />
      </span>

      {/* Right Side */}
      <span className="w-1/2 h-[100dvh] flex flex-col justify-center items-center max-lg:w-full max-lg:px-[10%]">
        <AuthTabs
          formFields={formFields}
          goTo={goToRegister}
          handleSubmit={handleSubmit}
        />
        <div className="mt-2 text-center">
          <button
            onClick={() => router.push("/forgot-password")}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Forgot your password?
          </button>
        </div>
      </span>

      {error && (
        <div className="fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-md shadow-lg z-50">
          {error}
        </div>
      )}
    </section>
  );
}
