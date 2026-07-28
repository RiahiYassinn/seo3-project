import api from "@/lib/api";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_GATEWAY || "http://localhost:3006";

export interface UserProfile {
  id: string;
  email: string;
  username: string | null;
  first_name: string;
  last_name: string;
  role: string;
  avatar: string | null;
  bio: string | null;
  location: string | null;
  website: string | null;
  is_mentor: boolean;
  is_email_verified: boolean;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface ProfileUpdate {
  username?: string;
  first_name?: string;
  last_name?: string;
  bio?: string;
  location?: string;
  website?: string;
}

export const profileAPI = {
  async get() {
    const response = await api.get<UserProfile>("/auth/me/profile");
    return response.data;
  },

  async update(updates: ProfileUpdate) {
    const response = await api.patch<UserProfile>("/auth/me/profile", updates);
    return response.data;
  },

  async uploadAvatar(file: File) {
    const formData = new FormData();
    formData.append("avatar", file);

    const response = await api.post<UserProfile>("/auth/me/avatar", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    return response.data;
  },
};

/** Avatars come back as gateway-relative paths; make them renderable. */
export function resolveAvatarUrl(avatar?: string | null) {
  if (!avatar) return undefined;
  if (/^https?:\/\//i.test(avatar) || avatar.startsWith("blob:")) {
    return avatar;
  }
  return avatar.startsWith("/") ? `${API_BASE_URL}${avatar}` : avatar;
}

export function initialsFor(profile?: {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}) {
  if (!profile) return "?";

  const initials = `${profile.first_name?.charAt(0) ?? ""}${
    profile.last_name?.charAt(0) ?? ""
  }`.toUpperCase();

  return initials || profile.email?.charAt(0)?.toUpperCase() || "?";
}

export function fullNameFor(profile?: {
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
  email?: string | null;
}) {
  if (!profile) return "";

  return (
    [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
    profile.username ||
    profile.email ||
    ""
  );
}

export const roleLabels: Record<string, string> = {
  developer: "Developer",
  tech_lead: "Tech lead",
  admin: "Administrator",
};

export function roleLabel(role?: string | null) {
  const key = String(role || "").toLowerCase();
  return (
    roleLabels[key] ||
    key.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) ||
    "Member"
  );
}

export function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
