import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/session";
import { CategoryForm } from "./category-form";

export const metadata: Metadata = { title: "Categorias financeiras" };

export default async function CategoriesPage() {
  const profile = await getCurrentProfile();
  if (profile?.role !== "ADMIN") {
    redirect("/admin/financeiro");
  }

  const supabase = await createClient();
  const { data: categories } = await supabase
    .from("financial_categories")
    .select("id, kind, name, active")
    .order("kind")
    .order("name");

  const income = (categories ?? []).filter((c) => c.kind === "INCOME");
  const expense = (categories ?? []).filter((c) => c.kind === "EXPENSE");

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">
        Categorias financeiras
      </h1>

      <div className="grid gap-8 sm:grid-cols-2">
        <div>
          <h2 className="mb-3 font-medium">Receitas</h2>
          <ul className="mb-4 grid gap-1 text-sm">
            {income.map((c) => (
              <li key={c.id} className="text-muted-foreground">
                {c.name}
              </li>
            ))}
          </ul>
          <CategoryForm kind="INCOME" />
        </div>
        <div>
          <h2 className="mb-3 font-medium">Despesas</h2>
          <ul className="mb-4 grid gap-1 text-sm">
            {expense.map((c) => (
              <li key={c.id} className="text-muted-foreground">
                {c.name}
              </li>
            ))}
          </ul>
          <CategoryForm kind="EXPENSE" />
        </div>
      </div>
    </div>
  );
}
