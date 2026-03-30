// "use client";
// import { useState, ChangeEvent, FormEvent, ReactNode } from "react";
// import Image from "next/image";
// import { useRouter } from "next/navigation";
// import {
//   Ripple,
//   AnimatedForm,
//   TechOrbitDisplay,
// } from "@/components/ui/modern-animated-sign-in";
// import { authAPI } from "@/lib/auth";

// interface OrbitIcon {
//   component: () => ReactNode;
//   className: string;
//   duration?: number;
//   delay?: number;
//   radius?: number;
//   path?: boolean;
//   reverse?: boolean;
// }

// const iconsArray: OrbitIcon[] = [
//   {
//     component: () => (
//       <Image
//         width={100}
//         height={100}
//         src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/html5/html5-original.svg"
//         alt="HTML5"
//       />
//     ),
//     className: "size-[30px] border-none bg-transparent",
//     duration: 20,
//     delay: 20,
//     radius: 100,
//     path: false,
//     reverse: false,
//   },
//   {
//     component: () => (
//       <Image
//         width={100}
//         height={100}
//         src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/css3/css3-original.svg"
//         alt="CSS3"
//       />
//     ),
//     className: "size-[30px] border-none bg-transparent",
//     duration: 20,
//     delay: 10,
//     radius: 100,
//     path: false,
//     reverse: false,
//   },
//   {
//     component: () => (
//       <Image
//         width={100}
//         height={100}
//         src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/typescript/typescript-original.svg"
//         alt="TypeScript"
//       />
//     ),
//     className: "size-[50px] border-none bg-transparent",
//     radius: 210,
//     duration: 20,
//     path: false,
//     reverse: false,
//   },
//   {
//     component: () => (
//       <Image
//         width={100}
//         height={100}
//         src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/javascript/javascript-original.svg"
//         alt="JavaScript"
//       />
//     ),
//     className: "size-[50px] border-none bg-transparent",
//     radius: 210,
//     duration: 20,
//     delay: 20,
//     path: false,
//     reverse: false,
//   },
//   {
//     component: () => (
//       <Image
//         width={100}
//         height={100}
//         src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/tailwindcss/tailwindcss-original.svg"
//         alt="TailwindCSS"
//       />
//     ),
//     className: "size-[30px] border-none bg-transparent",
//     duration: 20,
//     delay: 20,
//     radius: 150,
//     path: false,
//     reverse: true,
//   },
//   {
//     component: () => (
//       <Image
//         width={100}
//         height={100}
//         src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/nextjs/nextjs-original.svg"
//         alt="Nextjs"
//       />
//     ),
//     className: "size-[30px] border-none bg-transparent",
//     duration: 20,
//     delay: 10,
//     radius: 150,
//     path: false,
//     reverse: true,
//   },
//   {
//     component: () => (
//       <Image
//         width={100}
//         height={100}
//         src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/react/react-original.svg"
//         alt="React"
//       />
//     ),
//     className: "size-[50px] border-none bg-transparent",
//     radius: 270,
//     duration: 20,
//     path: false,
//     reverse: true,
//   },
//   {
//     component: () => (
//       <Image
//         width={100}
//         height={100}
//         src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/figma/figma-original.svg"
//         alt="Figma"
//       />
//     ),
//     className: "size-[50px] border-none bg-transparent",
//     radius: 270,
//     duration: 20,
//     delay: 60,
//     path: false,
//     reverse: true,
//   },
//   {
//     component: () => (
//       <Image
//         width={100}
//         height={100}
//         src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/git/git-original.svg"
//         alt="Git"
//       />
//     ),
//     className: "size-[50px] border-none bg-transparent",
//     radius: 320,
//     duration: 20,
//     delay: 20,
//     path: false,
//     reverse: false,
//   },
// ];

// export default function RegisterPage() {
//   const router = useRouter();
//   const [formData, setFormData] = useState({
//     first_name: "", // Split name into first_name and last_name
//     last_name: "",
//     email: "",
//     username: "",
//     password: "",
//   });
//   const [error, setError] = useState("");
//   const [loading, setLoading] = useState(false);
//   const [success, setSuccess] = useState(false);

//   const handleInputChange = (
//     event: ChangeEvent<HTMLInputElement>,
//     name: "first_name" | "last_name" | "email" | "username" | "password",
//   ) => {
//     const value = event.target.value;
//     setFormData((prev) => ({
//       ...prev,
//       [name]: value,
//     }));
//     setError("");
//   };

//   const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
//     event.preventDefault();
//     setLoading(true);
//     setError("");

//     try {
//       await authAPI.register(formData);
//       setSuccess(true);
//       setTimeout(() => router.push("/login"), 5000);
//     } catch (err: any) {
//       setError(
//         err.response?.data?.message || "Registration failed. Please try again.",
//       );
//       console.error("Registration error:", err);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const goToLogin = (event: React.MouseEvent<HTMLButtonElement>) => {
//     event.preventDefault();
//     router.push("/login");
//   };

//   const handleGoogleLogin = () => {
//     window.location.href = authAPI.getGoogleAuthUrl();
//   };

//   const formFields = {
//     header: "Create an account",
//     subHeader: "Sign up to get started with SEO3 Platform",
//     fields: [
//       {
//         label: "First Name", // Split name field
//         required: true,
//         type: "text" as const,
//         placeholder: "Enter your first name",
//         onChange: (event: ChangeEvent<HTMLInputElement>) =>
//           handleInputChange(event, "first_name"),
//       },
//       {
//         label: "Last Name", // Added last name field
//         required: true,
//         type: "text" as const,
//         placeholder: "Enter your last name",
//         onChange: (event: ChangeEvent<HTMLInputElement>) =>
//           handleInputChange(event, "last_name"),
//       },
//       {
//         label: "Email",
//         required: true,
//         type: "email" as const,
//         placeholder: "Enter your email address",
//         onChange: (event: ChangeEvent<HTMLInputElement>) =>
//           handleInputChange(event, "email"),
//       },
//       {
//         label: "Username",
//         required: true, // Changed to required as per backend
//         type: "text" as const,
//         placeholder: "Choose a username",
//         onChange: (event: ChangeEvent<HTMLInputElement>) =>
//           handleInputChange(event, "username"),
//       },
//       {
//         label: "Password",
//         required: true,
//         type: "password" as const,
//         placeholder:
//           "Create a password (min 8 chars, with uppercase, lowercase, number, special char)",
//         onChange: (event: ChangeEvent<HTMLInputElement>) =>
//           handleInputChange(event, "password"),
//       },
//     ],
//     submitButton: loading ? "Creating account..." : "Sign up",
//     textVariantButton: "Already have an account? Sign in",
//   };

//   return (
//     <section className="flex max-lg:justify-center h-screen bg-background">
//       {/* Left Side */}
//       <span className="flex flex-col justify-center w-1/2 max-lg:hidden">
//         <Ripple mainCircleSize={200} />
//         <TechOrbitDisplay iconsArray={iconsArray} text="Skill Analysis" />
//       </span>

//       {/* Right Side */}
//       <span className="w-1/2 h-[100dvh] flex flex-col justify-center items-center max-lg:w-full max-lg:px-[10%]">
//         {success ? (
//           <div className="w-full max-w-sm text-center space-y-4">
//             <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
//               <svg
//                 className="w-8 h-8 text-primary"
//                 fill="none"
//                 viewBox="0 0 24 24"
//                 stroke="currentColor"
//               >
//                 <path
//                   strokeLinecap="round"
//                   strokeLinejoin="round"
//                   strokeWidth={2}
//                   d="M5 13l4 4L19 7"
//                 />
//               </svg>
//             </div>
//             <h2 className="text-2xl font-bold">Check your email</h2>
//             <p className="text-muted-foreground text-sm">
//               Registration successful! We sent a verification link to{" "}
//               <span className="font-medium text-foreground">
//                 {formData.email}
//               </span>
//               . Verify your email before logging in.
//             </p>
//             <p className="text-xs text-muted-foreground">
//               Redirecting to login in 5 seconds…
//             </p>
//             <button
//               onClick={() => router.push("/login")}
//               className="w-full py-2 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
//             >
//               Go to Login
//             </button>
//           </div>
//         ) : (
//           <AnimatedForm
//             {...formFields}
//             fieldPerRow={1}
//             onSubmit={handleSubmit}
//             goTo={goToLogin}
//             googleLogin="Sign up with Google"
//             onGoogleLogin={handleGoogleLogin}
//             errorField={error}
//           />
//         )}
//       </span>

//       {error && (
//         <div className="fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-md shadow-lg z-50">
//           {error}
//         </div>
//       )}
//     </section>
//   );
// }
