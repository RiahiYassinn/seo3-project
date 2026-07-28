"use client";

import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  BadgeCheck,
  CalendarDays,
  Camera,
  CircleAlert,
  CircleCheck,
  Clock3,
  Globe,
  KeyRound,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  ShieldCheck,
  X,
  type LucideIcon,
} from "lucide-react";
import { authAPI } from "@/lib/auth";
import {
  type ProfileUpdate,
  type UserProfile,
  formatDate,
  formatDateTime,
  fullNameFor,
  initialsFor,
  profileAPI,
  resolveAvatarUrl,
  roleLabel,
} from "@/lib/profile";
import { useAuthStore } from "@/lib/store";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export interface ProfileStat {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  hint?: string;
}

interface ProfileWorkspaceProps {
  /** Role-specific metrics shown under the identity header. */
  stats?: ProfileStat[];
  statsLoading?: boolean;
  /** Role-specific cards rendered in the main column. */
  children?: ReactNode;
  /** Role-specific cards rendered in the side column. */
  aside?: ReactNode;
}

const emptyForm: ProfileUpdate = {
  first_name: "",
  last_name: "",
  username: "",
  location: "",
  website: "",
  bio: "",
};

const toForm = (profile: UserProfile): ProfileUpdate => ({
  first_name: profile.first_name || "",
  last_name: profile.last_name || "",
  username: profile.username || "",
  location: profile.location || "",
  website: profile.website || "",
  bio: profile.bio || "",
});

/** Adds a scheme so the value is a usable link, e.g. "acme.dev" → https://acme.dev */
const normalizeWebsite = (value?: string) => {
  const trimmed = (value || "").trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
};

const errorMessage = (error: any, fallback: string) =>
  error?.response?.data?.message || error?.message || fallback;

export function ProfileWorkspace({
  stats,
  statsLoading,
  children,
  aside,
}: ProfileWorkspaceProps) {
  const { updateUser } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<ProfileUpdate>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");

  const loadProfile = useCallback(async () => {
    try {
      const data = await profileAPI.get();
      setProfile(data);
      setForm(toForm(data));
      setError("");
    } catch (requestError: any) {
      setError(errorMessage(requestError, "Unable to load your profile"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const displayName = useMemo(() => fullNameFor(profile ?? undefined), [profile]);
  const avatarSrc = resolveAvatarUrl(profile?.avatar);

  const applyProfile = (data: UserProfile) => {
    setProfile(data);
    setForm(toForm(data));
    // Keep the navbar/avatar in sync with what was just saved.
    updateUser({
      first_name: data.first_name,
      last_name: data.last_name,
      username: data.username || "",
      avatar: data.avatar,
      is_mentor: data.is_mentor,
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const data = await profileAPI.update({
        first_name: form.first_name?.trim(),
        last_name: form.last_name?.trim(),
        username: form.username?.trim(),
        location: form.location?.trim(),
        website: normalizeWebsite(form.website),
        bio: form.bio?.trim(),
      });

      applyProfile(data);
      setEditing(false);
      setSuccess("Profile updated.");
    } catch (requestError: any) {
      setError(errorMessage(requestError, "Unable to save your profile"));
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarChange = async (file?: File | null) => {
    if (!file) return;

    setUploading(true);
    setError("");
    setSuccess("");

    try {
      const data = await profileAPI.uploadAvatar(file);
      applyProfile(data);
      setSuccess("Profile picture updated.");
    } catch (requestError: any) {
      setError(errorMessage(requestError, "Unable to upload that image"));
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleChangePassword = async () => {
    setPasswordError("");
    setPasswordSuccess("");

    if (password.length < 8) {
      setPasswordError("Use at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setPasswordError("Those passwords do not match.");
      return;
    }

    setChangingPassword(true);

    try {
      await authAPI.changePassword(password);
      setPassword("");
      setConfirmPassword("");
      setPasswordSuccess("Password changed.");
    } catch (requestError: any) {
      setPasswordError(
        errorMessage(requestError, "Unable to change your password"),
      );
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[24rem] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  if (!profile) {
    return (
      <Card className="border-destructive/40 bg-destructive/10">
        <CardContent className="flex items-center gap-3 p-5 text-sm text-destructive">
          <CircleAlert className="h-4 w-4 shrink-0" />
          <span className="flex-1">{error || "Profile unavailable."}</span>
          <Button variant="outline" size="sm" onClick={() => loadProfile()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* -------------------------- Identity header -------------------------- */}
      <Card className="overflow-hidden border-border/60 bg-background/85 shadow-sm">
        <div
          aria-hidden="true"
          className="h-24 bg-[radial-gradient(30rem_10rem_at_20%_0%,hsl(var(--primary)/0.25),transparent),linear-gradient(120deg,hsl(var(--primary)/0.12),rgba(6,182,212,0.10))]"
        />
        <CardContent className="p-6 pt-0">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="group relative -mt-12 w-fit">
                <Avatar className="h-24 w-24 border-4 border-background shadow-md">
                  <AvatarImage src={avatarSrc} alt={displayName} />
                  <AvatarFallback className="bg-gradient-to-br from-primary to-cyan-500 text-2xl font-semibold text-white">
                    {initialsFor(profile)}
                  </AvatarFallback>
                </Avatar>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  aria-label="Change profile picture"
                  title="Change profile picture"
                  className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm transition-colors hover:text-foreground disabled:opacity-60"
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Camera className="h-4 w-4" />
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) =>
                    handleAvatarChange(event.target.files?.[0])
                  }
                />
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-2xl font-bold tracking-tight">
                    {displayName}
                  </h2>
                  <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                    {roleLabel(profile.role)}
                  </Badge>
                  {profile.is_mentor ? (
                    <Badge
                      variant="outline"
                      className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    >
                      Mentor
                    </Badge>
                  ) : null}
                </div>
                {profile.username ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    @{profile.username}
                  </p>
                ) : null}
                {profile.bio ? (
                  <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
                    {profile.bio}
                  </p>
                ) : null}

                <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" />
                    {profile.email}
                    {profile.is_email_verified ? (
                      <BadgeCheck className="h-3.5 w-3.5 text-emerald-500" />
                    ) : null}
                  </span>
                  {profile.location ? (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" />
                      {profile.location}
                    </span>
                  ) : null}
                  {profile.website ? (
                    <a
                      href={normalizeWebsite(profile.website)}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1.5 hover:text-foreground"
                    >
                      <Globe className="h-3.5 w-3.5" />
                      {profile.website.replace(/^https?:\/\//i, "")}
                    </a>
                  ) : null}
                </div>
              </div>
            </div>

            <Button
              type="button"
              variant={editing ? "ghost" : "outline"}
              className="gap-2 sm:shrink-0"
              onClick={() => {
                setEditing((current) => !current);
                setForm(toForm(profile));
                setError("");
                setSuccess("");
              }}
            >
              {editing ? (
                <>
                  <X className="h-4 w-4" />
                  Cancel
                </>
              ) : (
                <>
                  <Pencil className="h-4 w-4" />
                  Edit profile
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <CircleAlert className="h-4 w-4 shrink-0" />
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="flex items-center gap-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
          <CircleCheck className="h-4 w-4 shrink-0" />
          {success}
        </div>
      ) : null}

      {/* ------------------------------ Stats ------------------------------- */}
      {stats && stats.length > 0 ? (
        <div
          className={cn(
            "grid gap-4 sm:grid-cols-2",
            stats.length >= 4 ? "xl:grid-cols-4" : "xl:grid-cols-3",
          )}
        >
          {stats.map((stat) => (
            <Card
              key={stat.label}
              className="border-border/60 bg-background/80 shadow-sm"
            >
              <CardContent className="flex items-start justify-between gap-3 p-5">
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="mt-2 text-3xl font-semibold">
                    {statsLoading ? (
                      <span className="inline-block h-8 w-12 animate-pulse rounded bg-muted align-middle" />
                    ) : (
                      stat.value
                    )}
                  </p>
                  {stat.hint ? (
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {stat.hint}
                    </p>
                  ) : null}
                </div>
                <stat.icon className="h-5 w-5 shrink-0 text-muted-foreground/60" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* --------------------------- Details --------------------------- */}
          <Card className="border-border/60 bg-background/85 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Personal details</CardTitle>
              <p className="text-sm text-muted-foreground">
                How your name appears across recommendations, mentorship, and
                notifications.
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="first_name">First name</Label>
                  <Input
                    id="first_name"
                    value={form.first_name}
                    disabled={!editing || saving}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        first_name: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">Last name</Label>
                  <Input
                    id="last_name"
                    value={form.last_name}
                    disabled={!editing || saving}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        last_name: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={form.username}
                    disabled={!editing || saving}
                    placeholder="your-handle"
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        username: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={form.location}
                    disabled={!editing || saving}
                    placeholder="Tunis, TN"
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        location: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    value={form.website}
                    disabled={!editing || saving}
                    placeholder="https://example.dev"
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        website: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea
                    id="bio"
                    value={form.bio}
                    disabled={!editing || saving}
                    rows={4}
                    maxLength={500}
                    placeholder="A sentence or two about what you work on."
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        bio: event.target.value,
                      }))
                    }
                  />
                  {editing ? (
                    <p className="text-xs text-muted-foreground">
                      {(form.bio || "").length}/500
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="rounded-lg border border-border/60 bg-muted/20 px-4 py-3 text-xs leading-5 text-muted-foreground">
                Your email address and role are managed by an administrator.
              </div>

              {editing ? (
                <div className="flex flex-wrap gap-3">
                  <Button
                    type="button"
                    className="gap-2"
                    onClick={handleSave}
                    disabled={saving}
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CircleCheck className="h-4 w-4" />
                    )}
                    Save changes
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setEditing(false);
                      setForm(toForm(profile));
                    }}
                    disabled={saving}
                  >
                    Discard
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {children}
        </div>

        <div className="space-y-6">
          {/* -------------------------- Account meta ------------------------ */}
          <Card className="border-border/60 bg-background/85 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Account</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex items-start gap-3">
                <CalendarDays className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground">Member since</p>
                  <p className="font-medium">{formatDate(profile.created_at)}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Clock3 className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground">Last sign-in</p>
                  <p className="font-medium">
                    {formatDateTime(profile.last_login_at)}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground">Email verification</p>
                  <p className="font-medium">
                    {profile.is_email_verified ? "Verified" : "Not verified"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ---------------------------- Security -------------------------- */}
          <Card className="border-border/60 bg-background/85 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <KeyRound className="h-4 w-4" />
                Password
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Choose something at least 8 characters long.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new_password">New password</Label>
                <Input
                  id="new_password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  disabled={changingPassword}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm_password">Confirm password</Label>
                <Input
                  id="confirm_password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  disabled={changingPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
              </div>

              {passwordError ? (
                <p className="text-sm text-destructive">{passwordError}</p>
              ) : null}
              {passwordSuccess ? (
                <p className="text-sm text-emerald-600 dark:text-emerald-400">
                  {passwordSuccess}
                </p>
              ) : null}

              <Button
                type="button"
                variant="outline"
                className="w-full gap-2"
                onClick={handleChangePassword}
                disabled={changingPassword || !password || !confirmPassword}
              >
                {changingPassword ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <KeyRound className="h-4 w-4" />
                )}
                Update password
              </Button>
            </CardContent>
          </Card>

          {aside}
        </div>
      </div>
    </div>
  );
}
