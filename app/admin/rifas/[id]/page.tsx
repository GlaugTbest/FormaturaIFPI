import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/session";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/link-button";
import { centsToBRL } from "@/lib/money";
import { RaffleActions } from "./raffle-actions";

export const metadata: Metadata = { title: "Detalhes da rifa" };

const statusLabels: Record<string, string> = {
  OPEN: "Aberta",
  CLOSED: "Encerrada",
  CANCELLED: "Cancelada",
};

export default async function RaffleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: raffle } = await supabase
    .from("raffles")
    .select("*")
    .eq("id", id)
    .single();

  if (!raffle) notFound();

  const profile = await getCurrentProfile();
  const isAdmin = profile?.role === "ADMIN";

  const [{ data: points }, { data: sales }] = await Promise.all([
    supabase.from("raffle_points").select("status").eq("raffle_id", id),
    supabase
      .from("raffle_sales")
      .select("amount_cents")
      .eq("raffle_id", id)
      .eq("status", "CONFIRMED"),
  ]);

  const counts = { AVAILABLE: 0, RESERVED: 0, SOLD: 0, CANCELLED: 0 } as Record<
    string,
    number
  >;
  for (const p of points ?? []) counts[p.status] = (counts[p.status] ?? 0) + 1;
  const revenue = (sales ?? []).reduce((sum, s) => sum + s.amount_cents, 0);

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {raffle.title}
            </h1>
            <Badge>{statusLabels[raffle.status]}</Badge>
          </div>
          <p className="text-muted-foreground text-sm">/rifas/{raffle.slug}</p>
        </div>
        <div className="flex gap-2">
          <LinkButton variant="outline" size="sm" href={`/admin/rifas/${id}/numeros`}>
            Ver números
          </LinkButton>
          {isAdmin && raffle.status !== "CANCELLED" ? (
            <LinkButton variant="outline" size="sm" href={`/admin/rifas/${id}/editar`}>
              Editar
            </LinkButton>
          ) : null}
          <LinkButton variant="outline" size="sm" href={`/rifas/${raffle.slug}`} target="_blank">
            Ver página pública
          </LinkButton>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border p-3">
          <p className="text-muted-foreground text-xs">Vendidos</p>
          <p className="text-xl font-semibold">{counts.SOLD}</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-muted-foreground text-xs">Reservados</p>
          <p className="text-xl font-semibold">{counts.RESERVED}</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-muted-foreground text-xs">Disponíveis</p>
          <p className="text-xl font-semibold">{counts.AVAILABLE}</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-muted-foreground text-xs">Faturamento</p>
          <p className="text-xl font-semibold">{centsToBRL(revenue)}</p>
        </div>
      </div>

      {raffle.description ? (
        <p className="mb-4 text-sm whitespace-pre-wrap">{raffle.description}</p>
      ) : null}

      <dl className="text-muted-foreground mb-6 grid gap-1 text-sm">
        <div className="flex gap-2">
          <dt className="font-medium text-foreground">Valor por número:</dt>
          <dd>{centsToBRL(raffle.unit_price_cents)}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="font-medium text-foreground">Início:</dt>
          <dd>{new Date(raffle.starts_at).toLocaleString("pt-BR")}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="font-medium text-foreground">Encerramento:</dt>
          <dd>{new Date(raffle.ends_at).toLocaleString("pt-BR")}</dd>
        </div>
        {raffle.google_sheet_url ? (
          <div className="flex gap-2">
            <dt className="font-medium text-foreground">Planilha:</dt>
            <dd>
              <a
                href={raffle.google_sheet_url}
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                Abrir planilha
              </a>
            </dd>
          </div>
        ) : null}
      </dl>

      {isAdmin ? <RaffleActions raffleId={id} status={raffle.status} /> : null}
    </div>
  );
}
