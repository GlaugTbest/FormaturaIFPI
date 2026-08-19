import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/session";
import { AdminShell } from "./_components/admin-shell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();

  // The proxy already blocks unauthenticated/inactive users from reaching
  // here — this is a defensive second check, not the primary guard.
  if (!profile || !profile.active) {
    redirect("/login");
  }

  return (
    <AdminShell fullName={profile.full_name} role={profile.role}>
      {children}
    </AdminShell>
  );
}
