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
} from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
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
  });
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
      await api.patch(`/admin/users/${selectedUser.id}`, editForm);
      toast.success(`User ${editForm.username} updated successfully`);
      setEditDialogOpen(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (error: any) {
      console.error("Failed to update user:", error);
      toast.error(error.response?.data?.message || "Failed to update user");
    }
  };

  const openEditDialog = (user: User) => {
    setSelectedUser(user);
    setEditForm({
      email: user.email,
      username: user.username,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
    });
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
        return "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400";
      case "tech_lead":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400";
      case "developer":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <div className="p-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <h3 className="font-medium text-gray-600 dark:text-gray-400 text-sm mb-1">
            Total Users
          </h3>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {stats.total}
          </p>
        </div>

        <div className="p-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <Shield className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
          </div>
          <h3 className="font-medium text-gray-600 dark:text-gray-400 text-sm mb-1">
            Admins
          </h3>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {stats.admins}
          </p>
        </div>

        <div className="p-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <Shield className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
          <h3 className="font-medium text-gray-600 dark:text-gray-400 text-sm mb-1">
            Tech Leads
          </h3>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {stats.tech_leads}
          </p>
        </div>

        <div className="p-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <h3 className="font-medium text-gray-600 dark:text-gray-400 text-sm mb-1">
            Developers
          </h3>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {stats.developers}
          </p>
        </div>

        <div className="p-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <h3 className="font-medium text-gray-600 dark:text-gray-400 text-sm mb-1">
            Active Today
          </h3>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {stats.active_today}
          </p>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between mb-6">
          <div className="flex-1 relative w-full md:w-auto">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 w-full border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-3 w-full md:w-auto">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Roles</option>
              <option value="admin">Admin</option>
              <option value="tech_lead">Tech Lead</option>
              <option value="developer">Developer</option>
            </select>

            <button
              onClick={openAddDialog}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <UserPlus className="h-4 w-4" />
              Add User
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-3 px-4 font-semibold text-sm text-gray-700 dark:text-gray-300">
                  User
                </th>
                <th className="text-left py-3 px-4 font-semibold text-sm text-gray-700 dark:text-gray-300">
                  Email
                </th>
                <th className="text-left py-3 px-4 font-semibold text-sm text-gray-700 dark:text-gray-300">
                  Role
                </th>
                <th className="text-left py-3 px-4 font-semibold text-sm text-gray-700 dark:text-gray-300">
                  Status
                </th>
                <th className="text-left py-3 px-4 font-semibold text-sm text-gray-700 dark:text-gray-300">
                  Joined
                </th>
                <th className="text-right py-3 px-4 font-semibold text-sm text-gray-700 dark:text-gray-300">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr
                  key={user.id}
                  className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-semibold">
                        {user.first_name?.[0]}
                        {user.last_name?.[0]}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-gray-100">
                          {user.first_name} {user.last_name}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          @{user.username}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {user.email}
                      </span>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(user.role)}`}
                    >
                      {user.role.replace("_", " ").toUpperCase()}
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    {user.is_email_verified ? (
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                        <span className="text-sm text-green-700 dark:text-green-400">
                          Verified
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                        <span className="text-sm text-orange-700 dark:text-orange-400">
                          Pending
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="py-4 px-4">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {new Date(user.created_at).toLocaleDateString()}
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center justify-end gap-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                            <MoreVertical className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => openEditDialog(user)}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Edit User
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => openDeleteDialog(user)}
                            className="text-red-600 dark:text-red-400"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete User
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
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400">
                No users found matching your criteria
              </p>
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
              className="bg-red-600 hover:bg-red-700"
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
            <div className="grid gap-2">
              <Label htmlFor="role">Role</Label>
              <Select
                value={editForm.role}
                onValueChange={(value) =>
                  setEditForm({ ...editForm, role: value })
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
                      <p className="text-xs text-red-500">
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
                      <p className="text-xs text-red-500">
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
                    <p className="text-xs text-red-500">
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
                    <p className="text-xs text-red-500">
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
                    <p className="text-xs text-red-500">{addFormErrors.role}</p>
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
                <Button
                  onClick={handleAddUser}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Create User
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
