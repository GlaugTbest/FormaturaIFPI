"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const PAGE_SIZE = 300;

type PointStatus = "AVAILABLE" | "RESERVED" | "SOLD" | "CANCELLED";

const statusLabels: Record<PointStatus, string> = {
  AVAILABLE: "Disponível",
  RESERVED: "Reservado",
  SOLD: "Vendido",
  CANCELLED: "Cancelado",
};

const statusClasses: Record<PointStatus, string> = {
  AVAILABLE: "bg-muted hover:bg-primary/10 cursor-pointer",
  RESERVED: "bg-amber-500/15 text-amber-700 dark:text-amber-400 cursor-not-allowed",
  SOLD: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 cursor-not-allowed",
  CANCELLED: "bg-destructive/10 text-destructive cursor-not-allowed",
};

export function NumberGrid({
  raffleId,
  selected,
  onToggle,
  refreshKey,
}: {
  raffleId: string;
  selected: number[];
  onToggle: (pointNumber: number) => void;
  refreshKey: number;
}) {
  const [points, setPoints] = useState<
    { point_number: number; status: PointStatus }[]
  >([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-page-change pattern
    setLoading(true);
    const supabase = createClient();

    supabase
      .from("public_raffle_points")
      .select("point_number, status", { count: "exact" })
      .eq("raffle_id", raffleId)
      .order("point_number", { ascending: true })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)
      .then(({ data, count }) => {
        if (cancelled) return;
        setPoints((data as typeof points) ?? []);
        setTotal(count ?? 0);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [raffleId, page, refreshKey]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(56px,1fr))] gap-2">
        {loading
          ? Array.from({ length: 40 }).map((_, i) => (
              <div key={i} className="bg-muted h-12 animate-pulse rounded-md" />
            ))
          : points.map((point) => {
              const isSelected = selected.includes(point.point_number);
              const clickable = point.status === "AVAILABLE";
              return (
                <button
                  key={point.point_number}
                  type="button"
                  disabled={!clickable}
                  onClick={() => clickable && onToggle(point.point_number)}
                  title={statusLabels[point.status]}
                  className={cn(
                    "flex flex-col items-center rounded-md border py-2 text-xs font-medium transition-colors",
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground"
                      : statusClasses[point.status],
                  )}
                >
                  <span className="font-mono text-sm">{point.point_number}</span>
                </button>
              );
            })}
      </div>

      {totalPages > 1 ? (
        <div className="mt-4 flex items-center gap-2 text-sm">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            Anterior
          </Button>
          <span className="text-muted-foreground">
            Página {page + 1} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
          >
            Próxima
          </Button>
        </div>
      ) : null}

      <div className="text-muted-foreground mt-4 flex flex-wrap gap-3 text-xs">
        {(Object.keys(statusLabels) as PointStatus[]).map((key) => (
          <span key={key} className="flex items-center gap-1.5">
            <span
              className={cn("size-2.5 rounded-full", statusClasses[key])}
            />
            {statusLabels[key]}
          </span>
        ))}
      </div>
    </div>
  );
}
