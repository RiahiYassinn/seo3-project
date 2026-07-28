"use client";

import { notificationTypeMeta, priorityTone } from "@/lib/notifications";
import { cn } from "@/lib/utils";

interface NotificationIconProps {
  type: string;
  priority: string;
  size?: "sm" | "md";
  className?: string;
  muted?: boolean;
}

/** Priority-toned chip carrying the notification's type glyph. */
export function NotificationIcon({
  type,
  priority,
  size = "sm",
  className,
  muted = false,
}: NotificationIconProps) {
  const { icon: Icon } = notificationTypeMeta(type);
  const tone = priorityTone(priority);

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-xl transition-opacity",
        size === "sm" ? "h-9 w-9" : "h-11 w-11",
        tone.chip,
        muted && "opacity-60",
        className,
      )}
    >
      <Icon className={size === "sm" ? "h-4 w-4" : "h-5 w-5"} />
    </span>
  );
}
