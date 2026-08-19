import type { Metadata } from "next";
import { getCurrentProfile } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Painel" };

export default async function DashboardPage() {
  const profile = await getCurrentProfile();

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">
        Olá, {profile?.full_name.split(" ")[0]}
      </h1>
      <p className="text-muted-foreground mt-1 text-sm">
        O painel com indicadores de rifas e financeiro chega nas próximas
        etapas.
      </p>
    </div>
  );
}
