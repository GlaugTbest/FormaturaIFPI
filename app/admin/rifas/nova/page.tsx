import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/session";
import { RaffleForm } from "../raffle-form";

export const metadata: Metadata = { title: "Nova rifa" };

export default async function NewRafflePage() {
  const profile = await getCurrentProfile();
  if (profile?.role !== "ADMIN") {
    redirect("/admin/rifas");
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Nova rifa</h1>
      <RaffleForm />
    </div>
  );
}
