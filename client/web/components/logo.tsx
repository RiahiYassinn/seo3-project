import Image from "next/image";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  priority?: boolean;
}

/**
 * Theme-aware logo.
 *
 * Both variants are rendered and CSS picks one, so the markup is identical on
 * the server and the client. Choosing the src from JS theme state instead would
 * mismatch during hydration, because the server cannot know the saved theme.
 */
export function Logo({ className, priority }: LogoProps) {
  return (
    <>
      <Image
        src="/logo-light.png"
        alt="Dev.Lab"
        width={400}
        height={150}
        priority={priority}
        className={cn("w-auto dark:hidden", className)}
      />
      <Image
        src="/logo-dark.png"
        alt=""
        aria-hidden="true"
        width={400}
        height={150}
        priority={priority}
        className={cn("hidden w-auto dark:block", className)}
      />
    </>
  );
}
