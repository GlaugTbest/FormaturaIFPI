import { redirect } from "next/navigation";

// /admin has no content of its own — layout.tsx wraps every /admin/* page
// but doesn't render anything for the bare /admin segment itself, so
// visiting it directly 404s without this. Dashboard is the natural landing
// page once logged in.
export default function AdminIndexPage() {
  redirect("/admin/dashboard");
}
