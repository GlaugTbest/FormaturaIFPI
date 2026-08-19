"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AUDIT_ACTION_LABELS, AUDIT_ENTITY_TYPE_LABELS } from "@/lib/audit";

export function AuditRow({
  action,
  entityType,
  entityId,
  userName,
  createdAt,
  oldData,
  newData,
  metadata,
}: {
  action: string;
  entityType: string;
  entityId: string | null;
  userName: string | null;
  createdAt: string;
  oldData: unknown;
  newData: unknown;
  metadata: unknown;
}) {
  const [open, setOpen] = useState(false);
  const hasDetails = oldData !== null || newData !== null || metadata !== null;

  return (
    <>
      <tr className="border-b last:border-0">
        <td className="py-2 pr-4">{AUDIT_ACTION_LABELS[action] ?? action}</td>
        <td className="py-2 pr-4">
          <div>{AUDIT_ENTITY_TYPE_LABELS[entityType] ?? entityType}</div>
          {entityId ? (
            <div className="text-muted-foreground font-mono text-xs">{entityId.slice(0, 8)}</div>
          ) : null}
        </td>
        <td className="py-2 pr-4">{userName ?? "Sistema / anônimo"}</td>
        <td className="py-2 pr-4">{new Date(createdAt).toLocaleString("pt-BR")}</td>
        <td className="py-2 pr-4">
          {hasDetails ? (
            <Button variant="outline" size="sm" onClick={() => setOpen((v) => !v)}>
              {open ? "Ocultar" : "Detalhes"}
            </Button>
          ) : null}
        </td>
      </tr>
      {open ? (
        <tr className="border-b last:border-0">
          <td colSpan={5} className="bg-muted/40 py-3">
            <div className="grid gap-2 sm:grid-cols-3">
              {oldData !== null ? (
                <div>
                  <p className="mb-1 text-xs font-medium">Antes</p>
                  <pre className="overflow-x-auto rounded bg-black/5 p-2 text-xs dark:bg-white/5">
                    {JSON.stringify(oldData, null, 2)}
                  </pre>
                </div>
              ) : null}
              {newData !== null ? (
                <div>
                  <p className="mb-1 text-xs font-medium">Depois</p>
                  <pre className="overflow-x-auto rounded bg-black/5 p-2 text-xs dark:bg-white/5">
                    {JSON.stringify(newData, null, 2)}
                  </pre>
                </div>
              ) : null}
              {metadata !== null ? (
                <div>
                  <p className="mb-1 text-xs font-medium">Detalhes</p>
                  <pre className="overflow-x-auto rounded bg-black/5 p-2 text-xs dark:bg-white/5">
                    {JSON.stringify(metadata, null, 2)}
                  </pre>
                </div>
              ) : null}
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}
