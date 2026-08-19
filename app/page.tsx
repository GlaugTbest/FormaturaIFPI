import Link from "next/link";
import { getEventInfo } from "@/lib/settings";

export default async function Home() {
  const event = await getEventInfo();
  const subtitle = [event.course, event.className].filter(Boolean).join(" · ");

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">{event.name}</h1>
      {subtitle ? <p className="text-muted-foreground text-sm">{subtitle}</p> : null}
      <p className="text-muted-foreground max-w-md">
        <Link href="/rifas" className="underline underline-offset-4">
          Veja as rifas ativas
        </Link>{" "}
        e ajude a comissão.
      </p>
    </main>
  );
}
