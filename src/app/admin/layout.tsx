import { requireProfile } from "@/lib/auth";
import { AdminShell } from "@/components/AdminShell";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireProfile(["admin", "reviewer"]);
  return (
    <AdminShell name={profile.full_name || "Admin"} role={profile.role}>
      {children}
    </AdminShell>
  );
}
