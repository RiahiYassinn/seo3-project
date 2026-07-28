"use client";
import React, { useState, useEffect } from "react";
import {
  Search,
  UserPlus,
  Trash2,
  Edit,
  MoreVertical,
  Mail,
  Shield,
  CheckCircle,
  AlertCircle,
  Code as Code2,
  UserCog,
  Users,
} from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuthStore } from "@/lib/store";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface User {
  id: string;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  role: string;
  avatar?: string | null;
  is_mentor?: boolean;
  is_email_verified: boolean;
  created_at: string;
  last_login?: string;
}

interface UserStats {
  total: number;
  admins: number;
  developers: number;
  tech_leads: number;
  active_today: number;
}

const generateSecurePassword = () => {
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const digits = "0123456789";
  const special = "@$!%*?&";
  const all = upper + lower + digits + special;
  const required = [
    upper[Math.floor(Math.random() * upper.length)],
    lower[Math.floor(Math.random() * lower.length)],
    digits[Math.floor(Math.random() * digits.length)],
    special[Math.floor(Math.random() * special.length)],
  ];
  const rest = Array.from(
    { length: 8 },
    () => all[Math.floor(Math.random() * all.length)],
  );
  return [...required, ...rest].sort(() => Math.random() - 0.5).join("");
};

export const UsersManagementTable = () => {
  const { user: currentUser, updateUser } = useAuthStore();
  const apiGatewayBaseUrl =
    process.env.NEXT_PUBLIC_API_GATEWAY || "http://localhost:3006";
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<UserStats>({
    total: 0,
    admins: 0,
    developers: 0,
    tech_leads: 0,
    active_today: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({
    email: "",
    username: "",
    first_name: "",
    last_name: "",
    role: "",
    is_mentor: false,
  });
  const [avatarPreview, setAvatarPreview] = useState<string>("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [addForm, setAddForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    username: "",
    role: "developer",
  });
  const [addFormErrors, setAddFormErrors] = useState<{
    first_name?: string;
    last_name?: string;
    email?: string;
    username?: string;
    password?: string;
    role?: string;
  }>({});
  const [addSuccess, setAddSuccess] = useState(false);
  const [addSuccessEmail, setAddSuccessEmail] = useState("");

  const resolveAvatarUrl = (avatar?: string | null) => {
    if (!avatar) return undefined;
    if (/^https?:\/\//i.test(avatar) || avatar.startsWith("blob:")) {
      return avatar;
    }
    if (avatar.startsWith("/")) {
      return `${apiGatewayBaseUrl}${avatar}`;
    }
    return avatar;
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await api.get("/admin/users");
      setUsers(response.data.users || []);

      const total = response.data.users?.length || 0;
      const admins =
        response.data.users?.filter((u: User) => u.role === "admin").length ||
        0;
      const developers =
        response.data.users?.filter((u: User) => u.role === "developer")
          .length || 0;
      const tech_leads =
        response.data.users?.filter((u: User) => u.role === "tech_lead")
          .length || 0;

      setStats({
        total,
        admins,
        developers,
        tech_leads,
        active_today: response.data.active_today || 0,
      });
    } catch (error: any) {
      console.error("Failed to fetch users:", error);
      toast.error("Failed to fetch users. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const validateAddForm = () => {
    const errors: typeof addFormErrors = {};

    if (!addForm.first_name) {
      errors.first_name = "First name is required";
    }

    if (!addForm.last_name) {
      errors.last_name = "Last name is required";
    }

    if (!addForm.email) {
      errors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(addForm.email)) {
      errors.email = "Please enter a valid email address";
    }

    if (!addForm.username) {
      errors.username = "Username is required";
    } else if (addForm.username.length < 3) {
      errors.username = "Username must be at least 3 characters";
    }

    if (!addForm.role) {
      errors.role = "Role is required";
    }

    setAddFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddUser = async () => {
    if (!validateAddForm()) return;
    const generatedPassword = generateSecurePassword();
    try {
      await api.post("/admin/users", {
        first_name: addForm.first_name,
        last_name: addForm.last_name,
        email: addForm.email,
        username: addForm.username,
        password: generatedPassword,
        role: addForm.role,
      });
      setAddSuccessEmail(addForm.email);
      setAddSuccess(true);

      setTimeout(() => {
        setAddDialogOpen(false);
        setAddSuccess(false);
        resetAddForm();
        fetchUsers();
      }, 3000);

      toast.success(
        `User ${addForm.username} created successfully with role ${addForm.role}! Verification email sent.`,
      );
    } catch (error: any) {
      console.error("Failed to create user:", error);
      toast.error(error.response?.data?.message || "Failed to create user");
    }
  };

  const resetAddForm = () => {
    setAddForm({
      first_name: "",
      last_name: "",
      email: "",
      username: "",
      role: "developer",
    });
    setAddFormErrors({});
    setAddSuccess(false);
    setAddSuccessEmail("");
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    try {
      await api.delete(`/admin/users/${selectedUser.id}`);
      toast.success(`User ${selectedUser.username} deleted successfully`);
      setDeleteDialogOpen(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (error: any) {
      console.error("Failed to delete user:", error);
      toast.error(error.response?.data?.message || "Failed to delete user");
    }
  };

  const handleEditUser = async () => {
    if (!selectedUser) return;

    try {
      const patchResponse = await api.patch(`/admin/users/${selectedUser.id}`, {
        ...editForm,
        ...(removeAvatar && !avatarFile ? { avatar: "" } : {}),
      });

      let nextAvatar =
        patchResponse?.data?.avatar ?? selectedUser.avatar ?? null;

      if (avatarFile) {
        const formData = new FormData();
        formData.append("avatar", avatarFile);
        const uploadResponse = await api.post(
          `/admin/users/${selectedUser.id}/avatar`,
          formData,
          {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          },
        );
        nextAvatar =
          uploadResponse?.data?.avatar ??
          uploadResponse?.data?.avatar_url ??
          nextAvatar;
      }

      if (removeAvatar && !avatarFile) {
        nextAvatar = null;
      }

      if (currentUser?.id === selectedUser.id) {
        updateUser({
          email: editForm.email,
          username: editForm.username,
          first_name: editForm.first_name,
          last_name: editForm.last_name,
          role: editForm.role,
          avatar: nextAvatar,
        });
      }

      toast.success(`User ${editForm.username} updated successfully`);
      setEditDialogOpen(false);
      setSelectedUser(null);
      setAvatarPreview("");
      setAvatarFile(null);
      setRemoveAvatar(false);
      fetchUsers();
    } catch (error: any) {
      console.error("Failed to update user:", error);
      toast.error(error.response?.data?.message || "Failed to update user");
    }
  };

  const handleAvatarFileChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0] || null;
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file.");
      event.target.value = "";
      return;
    }

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error("Image must be smaller than 5MB.");
      event.target.value = "";
      return;
    }

    setAvatarFile(file);
    setRemoveAvatar(false);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const openEditDialog = (user: User) => {
    setSelectedUser(user);
    setEditForm({
      email: user.email,
      username: user.username,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
      is_mentor: Boolean(user.is_mentor),
    });
    setAvatarPreview(resolveAvatarUrl(user.avatar) || "");
    setAvatarFile(null);
    setRemoveAvatar(false);
    setEditDialogOpen(true);
  };

  const openDeleteDialog = (user: User) => {
    setSelectedUser(user);
    setDeleteDialogOpen(true);
  };

  const openAddDialog = () => {
    resetAddForm();
    setAddDialogOpen(true);
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.last_name.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRole = roleFilter === "all" || user.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "admin":
        return "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300";
      case "tech_lead":
        return "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300";
      case "developer":
        return "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300";
      default:
        return "border-border/60 bg-muted text-muted-foreground";
    }
  };

  const statTiles = [
    {
      label: "Total users",
      value: stats.total,
      icon: Users,
      tone: "bg-primary/10 text-primary",
    },
    {
      label: "Admins",
      value: stats.admins,
      icon: Shield,
      tone: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    },
    {
      label: "Tech leads",
      value: stats.tech_leads,
      icon: UserCog,
      tone: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    },
    {
      label: "Developers",
      value: stats.developers,
      icon: Code2,
      tone: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
    },
    {
      label: "Active today",
      value: stats.active_today,
      icon: CheckCircle,
      tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          {[0, 1, 2, 3, 4].map((tile) => (
            <div key={tile} className="h-24 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
        <div className="h-[28rem] animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {statTiles.map((tile) => (
          <div
            key={tile.label}
            className="rounded-xl border border-border/60 bg-background/80 p-5 shadow-sm"
          >
            <span
              className={`flex h-9 w-9 items-center justify-center rounded-lg ${tile.tone}`}
            >
              <tile.icon className="h-4 w-4" />
            </span>
            <p className="mt-3 text-sm text-muted-foreground">{tile.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {tile.value}
            </p>
          </div>
        ))}
      </div>

      {/* Filters and Search */}
      <div className="rounded-xl border border-border/60 bg-background/80 shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border/60 p-4 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search by name, username, or email"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              aria-label="Search users"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {filteredUsers.length} of {users.length}
            </span>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-40" aria-label="Filter by role">
                <SelectValue placeholder="All roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="tech_lead">Tech lead</SelectItem>
                <SelectItem value="developer">Developer</SelectItem>
              </SelectContent>
            </Select>

            <Button onClick={openAddDialog} className="gap-2">
              <UserPlus className="h-4 w-4" />
              Add user
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/60 bg-muted/30">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  User
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Email
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Role
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Mentor
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Joined
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr
                  key={user.id}
                  className="border-b border-border/50 transition-colors last:border-b-0 hover:bg-muted/40"
                >
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9 border border-border/60">
                        <AvatarImage
                          src={resolveAvatarUrl(user.avatar)}
                          alt={`${user.first_name} ${user.last_name}`}
                        />
                        <AvatarFallback className="bg-gradient-to-br from-primary to-cyan-500 text-xs font-semibold text-white">
                          {user.first_name?.[0]}
                          {user.last_name?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {user.first_name} {user.last_name}
                          {user.id === currentUser?.id ? (
                            <span className="ml-2 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                              You
                            </span>
                          ) : null}
                        </p>
                        <p className="truncate text-sm text-muted-foreground">
                          @{user.username}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate text-sm text-muted-foreground">
                        {user.email}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${getRoleBadgeColor(user.role)}`}
                    >
                      {user.role.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    {user.role === "tech_lead" ? (
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                          user.is_mentor
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                            : "border-border/60 bg-muted text-muted-foreground"
                        }`}
                      >
                        {user.is_mentor ? "Available" : "Paused"}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    {user.is_email_verified ? (
                      <span className="inline-flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
                        <CheckCircle className="h-3.5 w-3.5" />
                        Verified
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400">
                        <AlertCircle className="h-3.5 w-3.5" />
                        Pending
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-sm text-muted-foreground">
                      {new Date(user.created_at).toLocaleDateString()}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center justify-end">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            aria-label={`Actions for ${user.username}`}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => openEditDialog(user)}
                            className="cursor-pointer"
                          >
                            <Edit className="mr-2 h-4 w-4" />
                            Edit user
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => openDeleteDialog(user)}
                            className="cursor-pointer text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete user
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredUsers.length === 0 && (
            <div className="px-6 py-16 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <Search className="h-5 w-5" />
              </div>
              <p className="mt-3 text-sm font-medium">No users found</p>
              <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
                {searchQuery || roleFilter !== "all"
                  ? "Try a different search term or role filter."
                  : "Add the first user to get started."}
              </p>
              {searchQuery || roleFilter !== "all" ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => {
                    setSearchQuery("");
                    setRoleFilter("all");
                  }}
                >
                  Clear filters
                </Button>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the user {selectedUser?.username}.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Make changes to the user account. Click save when you&apos;re
              done.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={editForm.email}
                onChange={(e) =>
                  setEditForm({ ...editForm, email: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={editForm.username}
                onChange={(e) =>
                  setEditForm({ ...editForm, username: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="first_name">First Name</Label>
                <Input
                  id="first_name"
                  value={editForm.first_name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, first_name: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="last_name">Last Name</Label>
                <Input
                  id="last_name"
                  value={editForm.last_name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, last_name: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="grid gap-3">
              <Label htmlFor="avatar">Avatar Image</Label>
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarImage
                    src={removeAvatar ? undefined : avatarPreview || undefined}
                    alt={`${editForm.first_name} ${editForm.last_name}`}
                  />
                  <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-600 text-white font-semibold">
                    {editForm.first_name?.[0] || selectedUser?.first_name?.[0]}
                    {editForm.last_name?.[0] || selectedUser?.last_name?.[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-1 items-center gap-2">
                  <Input
                    id="avatar"
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarFileChange}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setAvatarFile(null);
                      setAvatarPreview("");
                      setRemoveAvatar(true);
                    }}
                  >
                    Remove
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Choose an image from your computer (max 5MB). Click Remove to
                clear current avatar.
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="role">Role</Label>
              <Select
                value={editForm.role}
                onValueChange={(value) =>
                  setEditForm((prev) => ({
                    ...prev,
                    role: value,
                    is_mentor: value === "tech_lead" ? prev.is_mentor : false,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="tech_lead">Tech Lead</SelectItem>
                  <SelectItem value="developer">Developer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2 rounded-lg border border-border p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label htmlFor="is_mentor" className="text-sm font-medium">
                    Mentor Eligible
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Only tech leads with this enabled can be assigned mentorship
                    recommendations.
                  </p>
                </div>
                <Switch
                  id="is_mentor"
                  checked={editForm.is_mentor}
                  disabled={editForm.role !== "tech_lead"}
                  onCheckedChange={(checked) =>
                    setEditForm((prev) => ({ ...prev, is_mentor: checked }))
                  }
                />
              </div>
              {editForm.role !== "tech_lead" ? (
                <p className="text-xs text-muted-foreground">
                  Set role to Tech Lead to enable mentor assignment.
                </p>
              ) : null}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditUser}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add User Dialog */}
      <Dialog
        open={addDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            resetAddForm();
          }
          setAddDialogOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          {addSuccess ? (
            <div className="text-center space-y-4 py-8">
              <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center mx-auto">
                <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <DialogHeader>
                <DialogTitle>Check your email</DialogTitle>
                <DialogDescription>
                  Account created! A verification link{" "}
                  <strong>and their login credentials</strong> have been sent to{" "}
                  <span className="font-medium text-foreground">
                    {addSuccessEmail}
                  </span>
                  .
                </DialogDescription>
              </DialogHeader>
              <p className="text-xs text-muted-foreground">
                Closing this dialog in a moment...
              </p>
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Add New User</DialogTitle>
                <DialogDescription>
                  Create a new user account. Fill in the details below. A
                  verification email will be sent to the user.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="add-first_name">
                      First Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="add-first_name"
                      placeholder="John"
                      value={addForm.first_name}
                      onChange={(e) =>
                        setAddForm({ ...addForm, first_name: e.target.value })
                      }
                      className={
                        addFormErrors.first_name ? "border-red-500" : ""
                      }
                    />
                    {addFormErrors.first_name && (
                      <p className="text-xs text-destructive">
                        {addFormErrors.first_name}
                      </p>
                    )}
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="add-last_name">
                      Last Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="add-last_name"
                      placeholder="Doe"
                      value={addForm.last_name}
                      onChange={(e) =>
                        setAddForm({ ...addForm, last_name: e.target.value })
                      }
                      className={
                        addFormErrors.last_name ? "border-red-500" : ""
                      }
                    />
                    {addFormErrors.last_name && (
                      <p className="text-xs text-destructive">
                        {addFormErrors.last_name}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="add-email">
                    Email <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="add-email"
                    type="email"
                    placeholder="user@example.com"
                    value={addForm.email}
                    onChange={(e) =>
                      setAddForm({ ...addForm, email: e.target.value })
                    }
                    className={addFormErrors.email ? "border-red-500" : ""}
                  />
                  {addFormErrors.email && (
                    <p className="text-xs text-destructive">
                      {addFormErrors.email}
                    </p>
                  )}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="add-username">
                    Username <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="add-username"
                    placeholder="johndoe"
                    value={addForm.username}
                    onChange={(e) =>
                      setAddForm({ ...addForm, username: e.target.value })
                    }
                    className={addFormErrors.username ? "border-red-500" : ""}
                  />
                  {addFormErrors.username && (
                    <p className="text-xs text-destructive">
                      {addFormErrors.username}
                    </p>
                  )}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="add-role">
                    Role <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={addForm.role}
                    onValueChange={(value) =>
                      setAddForm({ ...addForm, role: value })
                    }
                  >
                    <SelectTrigger
                      className={addFormErrors.role ? "border-red-500" : ""}
                    >
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="developer">Developer</SelectItem>
                      <SelectItem value="tech_lead">Tech Lead</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  {addFormErrors.role && (
                    <p className="text-xs text-destructive">{addFormErrors.role}</p>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setAddDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleAddUser}>Create user</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
