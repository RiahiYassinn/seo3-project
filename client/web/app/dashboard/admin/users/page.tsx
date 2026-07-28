"use client";

import { AdminShell } from "@/components/admin/admin-shell";
import { UsersManagementTable } from "@/components/admin/users-management-table";

export default function AdminUsersPage() {
  return (
    <AdminShell
      title="User Administration"
      subtitle="Manage access, roles, and platform users from the same admin workspace that now controls GitHub analysis and contributor profiling."
    >
      <UsersManagementTable />
    </AdminShell>
  );
}
