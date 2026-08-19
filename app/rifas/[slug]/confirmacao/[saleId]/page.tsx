"use client";

import { use, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { centsToBRL } from "@/lib/money";
import type { SaleReceipt } from "@/lib/schemas/checkout";

export default function ConfirmationPage({
  params,
}: {
  params: Promise<{ slug: string; saleId: string }>;
}) {
  const { slug, saleId } = use(params);
  const [receipt, setReceipt] = useState<SaleReceipt | null | undefined>(
    undefined,
  );

  useEffect(() => {
    // sessionStorage isn't available during SSR, so this can't be a lazy
    // useState initializer — it has to run after mount.
    const raw = sessionStorage.getItem(`receipt:${saleId}`);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReceipt(raw ? JSON.parse(raw) : null);
  }, [saleId]);

  function copyToClipboard() {
    if (!receipt) return;
    const text = [
      `Rifa: ${receipt.raffleTitle}`,
      `Comprador: ${receipt.buyerName}`,
      `Números: ${receipt.pointNumbers.join(", ")}`,
      `Valor: ${centsToBRL(receipt.amountCents)}`,
      `Forma de pagamento: ${receipt.paymentMethod}`,
    ].join("\n");
    navigator.clipboard.writeText(text);
    toast.success("Copiado para a área de transferência.");
  }

  if (receipt === undefined) {
    return null;
  }

  if (receipt === null) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center p-6 text-center">
        <h1 className="text-xl font-semibold">Registro concluído</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Sua compra foi registrada com sucesso. Se você atualizou a página ou
          abriu este link em outro dispositivo, não temos mais os detalhes
          aqui para exibir — guarde a confirmação que apareceu no momento da
          compra.
        </p>
        <LinkButton className="mt-6" href={`/rifas/${slug}`}>
          Voltar para a rifa
        </LinkButton>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col p-6 print:p-0">
      <h1 className="text-xl font-semibold">Compra confirmada!</h1>
      <p className="text-muted-foreground mt-1 text-sm">
        Guarde esta confirmação.
      </p>

      <dl className="mt-6 grid gap-3 rounded-lg border p-4 text-sm">
        <div>
          <dt className="text-muted-foreground">Rifa</dt>
          <dd className="font-medium">{receipt.raffleTitle}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Comprador</dt>
          <dd className="font-medium">{receipt.buyerName}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Números</dt>
          <dd className="font-mono font-medium">
            {receipt.pointNumbers.join(", ")}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Valor</dt>
          <dd className="font-medium">{centsToBRL(receipt.amountCents)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Forma de pagamento</dt>
          <dd className="font-medium">{receipt.paymentMethod}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Data</dt>
          <dd className="font-medium">
            {new Date(receipt.createdAt).toLocaleString("pt-BR")}
          </dd>
        </div>
      </dl>

      <div className="mt-4 flex gap-2 print:hidden">
        <Button variant="outline" onClick={copyToClipboard}>
          Copiar
        </Button>
        <Button variant="outline" onClick={() => window.print()}>
          Imprimir
        </Button>
      </div>

      <LinkButton className="mt-6" href={`/rifas/${slug}`}>
        Voltar para a rifa
      </LinkButton>
    </main>
  );
}
