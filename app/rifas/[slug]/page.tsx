import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PurchaseFlow } from "./purchase-flow";
import { centsToBRL } from "@/lib/money";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: raffle } = await supabase
    .from("public_raffles")
    .select("title, description, image_url")
    .eq("slug", slug)
    .single();

  if (!raffle) return {};

  const title = raffle.title ?? "Rifa";

  return {
    title,
    description: raffle.description ?? undefined,
    alternates: { canonical: `/rifas/${slug}` },
    openGraph: {
      title,
      description: raffle.description ?? undefined,
      images: raffle.image_url ? [raffle.image_url] : undefined,
    },
  };
}

export default async function RafflePublicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: raffle } = await supabase
    .from("public_raffles")
    .select("*")
    .eq("slug", slug)
    .single();

  if (!raffle) notFound();

  const { data: paymentMethods } = await supabase
    .from("public_payment_methods")
    .select("*")
    .order("name");

  const { data: points } = await supabase
    .from("public_raffle_points")
    .select("status")
    .eq("raffle_id", raffle.id!);

  const counts = { AVAILABLE: 0, RESERVED: 0, SOLD: 0, CANCELLED: 0 } as Record<
    string,
    number
  >;
  for (const p of points ?? []) {
    if (p.status) counts[p.status] = (counts[p.status] ?? 0) + 1;
  }

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 p-4 py-8 sm:p-8">
      {raffle.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={raffle.image_url}
          alt=""
          className="mb-6 h-56 w-full rounded-xl object-cover"
        />
      ) : null}

      <h1 className="text-3xl font-semibold tracking-tight">{raffle.title}</h1>
      {raffle.description ? (
        <p className="text-muted-foreground mt-2 whitespace-pre-wrap">
          {raffle.description}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <span className="font-medium">
          {centsToBRL(raffle.unit_price_cents ?? 0)} por número
        </span>
        <span className="text-muted-foreground">
          {counts.AVAILABLE} números disponíveis de {raffle.total_points}
        </span>
      </div>

      {raffle.status === "CLOSED" ? (
        <p className="bg-muted mt-6 rounded-lg p-4 text-sm">
          Esta rifa já foi encerrada. Obrigado a todos que participaram!
        </p>
      ) : (
        <PurchaseFlow
          raffleId={raffle.id!}
          raffleSlug={raffle.slug!}
          unitPriceCents={raffle.unit_price_cents!}
          paymentMethods={paymentMethods ?? []}
        />
      )}

      {raffle.rules ? (
        <details className="mt-8 text-sm">
          <summary className="cursor-pointer font-medium">
            Regulamento
          </summary>
          <p className="text-muted-foreground mt-2 whitespace-pre-wrap">
            {raffle.rules}
          </p>
        </details>
      ) : null}
    </main>
  );
}
