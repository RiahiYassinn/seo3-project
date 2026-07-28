import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AuthBootstrap } from "@/components/auth-bootstrap";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("http://localhost:3000"),
  title: {
    default: "Dev.Lab — Technical Skill Intelligence for engineering teams",
    template: "%s · Dev.Lab",
  },
  description:
    "Dev.Lab analyzes commits, code reviews, and discussions to map developer strengths, detect skill gaps, and recommend the right learning path or mentor.",
  openGraph: {
    title: "Dev.Lab — Technical Skill Intelligence for engineering teams",
    description:
      "Turn your team's commits into a living skill map: evidence-backed profiles, ranked skill gaps, and personalised learning paths.",
    type: "website",
  },
  icons: {
    icon: [
      { url: "/logoLight.png", media: "(prefers-color-scheme: light)" },
      { url: "/logoDark.png", media: "(prefers-color-scheme: dark)" },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const themeScript = `
    (function() {
      try {
        var savedTheme = localStorage.getItem("theme");
        var theme = savedTheme === "dark" || savedTheme === "light"
          ? savedTheme
          : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
        document.documentElement.classList.toggle("dark", theme === "dark");
      } catch (error) {}
    })();
  `;

  return (
    // The inline script below sets the `dark` class before React hydrates, so
    // the root element's class legitimately differs from the server markup.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={inter.className}>
        <AuthBootstrap />
        {children}
      </body>
    </html>
  );
}
