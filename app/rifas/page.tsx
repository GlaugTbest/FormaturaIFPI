import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { centsToBRL } from "@/lib/money";
import { getEventInfo } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Rifas",
  description: "Participe das rifas da comissão de formatura.",
};

export default async function PublicRafflesPage() {
  const supabase = await createClient();
  const [{ data: raffles }, event] = await Promise.all([
    supabase.from("public_raffles").select("*").order("created_at", { ascending: false }),
    getEventInfo(),
  ]);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 p-4 py-10 sm:p-10">
      <h1 className="mb-2 text-3xl font-semibold tracking-tight">Rifas</h1>
      <p className="text-muted-foreground mb-8">
        Escolha seus números e apoie {event.name}.
      </p>

      {!raffles || raffles.length === 0 ? (
        <p className="text-muted-foreground">
          Nenhuma rifa disponível no momento.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {raffles.map((raffle) => (
            <Link
              key={raffle.id}
              href={`/rifas/${raffle.slug}`}
              className="hover:border-ring flex flex-col overflow-hidden rounded-xl border transition-colors"
            >
              {raffle.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={raffle.image_url}
                  alt=""
                  className="h-40 w-full object-cover"
                />
              ) : null}
              <div className="p-4">
                <p className="font-medium">{raffle.title}</p>
                <p className="text-muted-foreground mt-1 text-sm">
                  {centsToBRL(raffle.unit_price_cents ?? 0)} por número
                  {raffle.status === "CLOSED" ? " · Encerrada" : ""}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
