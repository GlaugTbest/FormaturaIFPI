import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PurchaseFlow } from "./purchase-flow";
import { centsToBRL } from "@/lib/money";
import { getReservationTtlMinutes } from "@/lib/settings";

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

  const reservationTtlMinutes = await getReservationTtlMinutes();

  const counts = { AVAILABLE: 0, RESERVED: 0, SOLD: 0, CANCELLED: 0 } as Record<
    string,
    number
  >;
  for (const p of points ?? []) {
    if (p.status) counts[p.status] = (counts[p.status] ?? 0) + 1;
  }
  const soldFraction = raffle.total_points
    ? (counts.SOLD + counts.RESERVED) / raffle.total_points
    : 0;

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 p-4 py-8 sm:p-8">
      {raffle.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={raffle.image_url}
          alt=""
          className="ring-foreground/8 mb-6 h-56 w-full rounded-lg object-cover ring-1"
        />
      ) : null}

      <h1 className="text-3xl font-semibold tracking-tight text-balance">
        {raffle.title}
      </h1>
      {raffle.description ? (
        <p className="text-muted-foreground mt-2 max-w-2xl whitespace-pre-wrap">
          {raffle.description}
        </p>
      ) : null}

      <div className="border-border bg-card ring-foreground/8 mt-6 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-dashed p-4 ring-1">
        <div>
          <p className="label-tag">Valor por número</p>
          <p className="font-figures text-2xl font-semibold">
            {centsToBRL(raffle.unit_price_cents ?? 0)}
          </p>
        </div>
        <div className="text-right">
          <p className="label-tag">Disponíveis</p>
          <p className="font-figures text-2xl font-semibold">
            {counts.AVAILABLE}
            <span className="text-muted-foreground text-base font-normal">
              {" "}
              / {raffle.total_points}
            </span>
          </p>
        </div>
        <div className="bg-secondary h-1.5 w-full overflow-hidden rounded-full">
          <div
            className="bg-confirmed h-full rounded-full transition-all"
            style={{ width: `${Math.round(soldFraction * 100)}%` }}
          />
        </div>
      </div>

      {raffle.status === "CLOSED" ? (
        <p className="border-border bg-secondary/60 mt-6 rounded-lg border border-dashed p-4 text-sm">
          Esta rifa já foi encerrada. Obrigado a todos que participaram!
        </p>
      ) : (
        <PurchaseFlow
          raffleId={raffle.id!}
          raffleSlug={raffle.slug!}
          unitPriceCents={raffle.unit_price_cents!}
          paymentMethods={paymentMethods ?? []}
          reservationTtlMinutes={reservationTtlMinutes}
        />
      )}

      {raffle.rules ? (
        <details className="group receipt-divider mt-8 pt-4 text-sm">
          <summary className="cursor-pointer font-medium marker:content-none">
            <span className="inline-flex items-center gap-1.5">
              <span className="text-muted-foreground transition-transform group-open:rotate-90">
                ›
              </span>
              Regulamento
            </span>
          </summary>
          <p className="text-muted-foreground mt-2 whitespace-pre-wrap">
            {raffle.rules}
          </p>
        </details>
      ) : null}
    </main>
  );
}
