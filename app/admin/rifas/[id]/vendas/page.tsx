import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/session";
import { centsToBRL } from "@/lib/money";
import { SaleRow } from "./sale-row";

export const metadata: Metadata = { title: "Vendas da rifa" };

export default async function RaffleSalesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: raffle }, profile, { data: sales }] = await Promise.all([
    supabase.from("raffles").select("id, title").eq("id", id).single(),
    getCurrentProfile(),
    supabase
      .from("raffle_sales")
      .select(
        "id, amount_cents, status, created_at, cancelled_reason, buyers(full_name, phone), payment_methods(name), profiles!raffle_sales_seller_id_fkey(full_name), raffle_sale_points(raffle_points(point_number))",
      )
      .eq("raffle_id", id)
      .order("created_at", { ascending: false }),
  ]);
  if (!raffle) notFound();

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">
        Vendas — {raffle.title}
      </h1>
      <p className="text-muted-foreground mb-6 text-sm">
        {sales?.length ?? 0} vendas registradas
      </p>

      {!sales || sales.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Nenhuma venda registrada ainda.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="text-muted-foreground border-b text-left">
                <th className="py-2 pr-4 font-medium">Comprador</th>
                <th className="py-2 pr-4 font-medium">Números</th>
                <th className="py-2 pr-4 font-medium">Valor</th>
                <th className="py-2 pr-4 font-medium">Pagamento</th>
                <th className="py-2 pr-4 font-medium">Vendedor</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 pr-4 font-medium">Data</th>
                {profile?.role === "ADMIN" ? (
                  <th className="py-2 pr-4 font-medium">Ações</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {sales.map((sale) => (
                <tr key={sale.id} className="border-b last:border-0">
                  <td className="py-2 pr-4">
                    <div>{sale.buyers?.full_name}</div>
                    <div className="text-muted-foreground text-xs">
                      {sale.buyers?.phone}
                    </div>
                  </td>
                  <td className="py-2 pr-4 font-mono">
                    {sale.raffle_sale_points
                      .map((sp) => sp.raffle_points?.point_number)
                      .filter((n) => n !== undefined)
                      .sort((a, b) => (a ?? 0) - (b ?? 0))
                      .join(", ")}
                  </td>
                  <td className="py-2 pr-4">{centsToBRL(sale.amount_cents)}</td>
                  <td className="py-2 pr-4">{sale.payment_methods?.name}</td>
                  <td className="py-2 pr-4">
                    {sale.profiles?.full_name ?? "Autoatendimento"}
                  </td>
                  <td className="py-2 pr-4">
                    {sale.status === "CONFIRMED" ? "Confirmada" : "Cancelada"}
                  </td>
                  <td className="py-2 pr-4">
                    {new Date(sale.created_at).toLocaleString("pt-BR")}
                  </td>
                  {profile?.role === "ADMIN" ? (
                    <td className="py-2 pr-4">
                      <SaleRow saleId={sale.id} status={sale.status} />
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
