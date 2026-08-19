// Populates the linked Supabase project with realistic-looking demo data so
// the system can be presented without an empty dashboard/reports. Goes
// through the same RPCs the app itself uses for raffle sales (never inserts
// raffle_sales/raffle_points rows directly) so every invariant (points
// marked SOLD, payment_records, audit_logs) ends up exactly as it would from
// a real purchase. Idempotent: safe to run more than once, it skips
// anything that already exists instead of duplicating it.
//
// Usage: node scripts/seed-demo-data.mjs
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import path from "node:path";
import { randomUUID, randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "../.env.local") });

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);
const anon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);

const RAFFLE_SLUG = "rifa-formatura-tads-2026";
const SEED_ORIGIN_TAG = "Dados de demonstração (seed)";
const DEMO_SELLER_EMAIL = "vendedor.demo@teste.local";

function daysAgo(n) {
  return new Date(Date.now() - n * 86_400_000);
}

async function ensureRaffle() {
  const { data: existing } = await admin.from("raffles").select("id").eq("slug", RAFFLE_SLUG).maybeSingle();
  if (existing) {
    console.log("Rifa de demonstração já existe, pulando criação.");
    return existing.id;
  }

  const { data: admins } = await admin.from("profiles").select("id").eq("role", "ADMIN").limit(1);
  const createdBy = admins?.[0]?.id ?? null;

  const { data: raffle, error } = await admin
    .from("raffles")
    .insert({
      slug: RAFFLE_SLUG,
      title: "Rifa da Formatura — Técnico em ADS 2026",
      description:
        "Ajude a turma de Análise e Desenvolvimento de Sistemas a custear a festa de formatura! " +
        "Prêmio: uma cesta de eletrônicos + vale-presente.",
      rules:
        "O sorteio será feito com base no resultado da Loteria Federal. Números pagos e não retirados " +
        "até a data do sorteio concorrem normalmente.",
      total_points: 50,
      unit_price_cents: 1000,
      starts_at: daysAgo(10).toISOString(),
      ends_at: daysAgo(-30).toISOString(),
      created_by: createdBy,
    })
    .select("id")
    .single();

  if (error) throw new Error("Falha ao criar rifa de demonstração: " + error.message);
  console.log("Rifa de demonstração criada:", raffle.id);
  return raffle.id;
}

async function ensureDemoSeller() {
  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id")
    .eq("full_name", "Vendedor Demonstração")
    .maybeSingle();
  if (existingProfile) {
    console.log("Vendedor de demonstração já existe, pulando criação.");
    return existingProfile.id;
  }

  const password = randomBytes(12).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({
    email: DEMO_SELLER_EMAIL,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Vendedor Demonstração", role: "VENDEDOR" },
  });
  if (error) throw new Error("Falha ao criar vendedor de demonstração: " + error.message);
  console.log("Vendedor de demonstração criado:", data.user.id);
  return { id: data.user.id, password };
}

async function sellPoints(client, raffleId, pointNumbers, buyer, paymentMethodId) {
  const token = randomUUID();
  const { error: reserveError } = await client.rpc("rpc_reserve_points", {
    p_raffle_id: raffleId,
    p_point_numbers: pointNumbers,
    p_reservation_token: token,
    p_client_identifier: `seed-${randomUUID()}`,
  });
  if (reserveError) throw new Error(`Falha ao reservar ${pointNumbers}: ${reserveError.message}`);

  const { data: receipt, error: confirmError } = await client.rpc("rpc_confirm_sale", {
    p_raffle_id: raffleId,
    p_reservation_token: token,
    p_buyer_full_name: buyer.name,
    p_buyer_phone: buyer.phone,
    p_buyer_whatsapp: buyer.phone,
    p_buyer_instagram: buyer.instagram ?? "",
    p_buyer_notes: "",
    p_payment_method_id: paymentMethodId,
    p_idempotency_key: randomUUID(),
    p_client_identifier: `seed-${randomUUID()}`,
  });
  if (confirmError) throw new Error(`Falha ao confirmar venda de ${buyer.name}: ${confirmError.message}`);
  return receipt;
}

async function ensureSales(raffleId) {
  const { count } = await admin
    .from("raffle_sales")
    .select("id", { count: "exact", head: true })
    .eq("raffle_id", raffleId);
  if (count && count > 0) {
    console.log(`Rifa já tem ${count} venda(s), pulando geração de vendas.`);
    return;
  }

  const { data: methods } = await admin.from("payment_methods").select("id, name");
  const pix = methods?.find((m) => m.name === "PIX")?.id;
  const dinheiro = methods?.find((m) => m.name === "Dinheiro")?.id;

  const buyers = [
    { name: "Mariana Alves Costa", phone: "(86) 99911-2233", points: [3, 7, 12], payment: pix },
    { name: "Pedro Henrique Souza", phone: "(86) 99822-3344", points: [5], payment: dinheiro },
    { name: "Beatriz Fernandes Lima", phone: "(86) 99733-4455", points: [18, 19, 20, 21], payment: pix },
    { name: "Lucas Gabriel Oliveira", phone: "(86) 99644-5566", points: [30], payment: dinheiro },
    { name: "Isabela Martins Rocha", phone: "(86) 99555-6677", points: [41, 42], payment: pix },
  ];

  for (const buyer of buyers) {
    await sellPoints(admin, raffleId, buyer.points, buyer, buyer.payment);
    console.log(`Venda registrada (autoatendimento): ${buyer.name} — números ${buyer.points.join(", ")}`);
  }

  const seller = await ensureDemoSeller();
  if (seller?.password) {
    const { error: signInError } = await anon.auth.signInWithPassword({
      email: DEMO_SELLER_EMAIL,
      password: seller.password,
    });
    if (signInError) {
      console.warn("Não foi possível autenticar como vendedor demo, venda assistida pulada:", signInError.message);
    } else {
      await sellPoints(
        anon,
        raffleId,
        [25, 26],
        { name: "Rafael Augusto Pereira", phone: "(86) 99466-7788" },
        dinheiro,
      );
      console.log("Venda registrada (assistida pelo Vendedor Demonstração): Rafael Augusto Pereira — números 25, 26");
      await anon.auth.signOut();
    }
  }
}

async function ensureFinancialTransactions() {
  const { data: existing } = await admin
    .from("financial_transactions")
    .select("id")
    .eq("origin", SEED_ORIGIN_TAG)
    .limit(1);
  if (existing && existing.length > 0) {
    console.log("Lançamentos financeiros de demonstração já existem, pulando.");
    return;
  }

  const { data: categories } = await admin.from("financial_categories").select("id, kind, name");
  const { data: methods } = await admin.from("payment_methods").select("id, name");
  const { data: admins } = await admin.from("profiles").select("id").eq("role", "ADMIN").limit(1);
  const { data: raffle } = await admin.from("raffles").select("id").eq("slug", RAFFLE_SLUG).maybeSingle();

  const createdBy = admins?.[0]?.id ?? null;
  const pix = methods?.find((m) => m.name === "PIX")?.id ?? null;
  const dinheiro = methods?.find((m) => m.name === "Dinheiro")?.id ?? null;

  function categoryId(kind, name) {
    return categories?.find((c) => c.kind === kind && c.name === name)?.id ?? null;
  }

  let supplierId = null;
  {
    const { data: existingSupplier } = await admin
      .from("suppliers")
      .select("id")
      .eq("name", "Buffet Sabor & Arte")
      .maybeSingle();
    if (existingSupplier) {
      supplierId = existingSupplier.id;
    } else {
      const { data: created } = await admin
        .from("suppliers")
        .insert({ name: "Buffet Sabor & Arte", contact: "(86) 99100-2000" })
        .select("id")
        .single();
      supplierId = created?.id ?? null;
    }
  }

  const rows = [
    {
      type: "INCOME",
      description: "Patrocínio — Ótica Visão Clara",
      category_id: categoryId("INCOME", "Patrocínio"),
      amount_cents: 50000,
      occurred_on: daysAgo(40).toISOString().slice(0, 10),
      payment_method_id: pix,
    },
    {
      type: "INCOME",
      description: "Contribuição mensal — turma (março)",
      category_id: categoryId("INCOME", "Contribuições"),
      amount_cents: 120000,
      occurred_on: daysAgo(35).toISOString().slice(0, 10),
      payment_method_id: pix,
    },
    {
      type: "INCOME",
      description: "Repasse em dinheiro — vendas de rifa presenciais",
      category_id: categoryId("INCOME", "Rifa"),
      amount_cents: 8000,
      occurred_on: daysAgo(5).toISOString().slice(0, 10),
      payment_method_id: dinheiro,
      raffle_id: raffle?.id ?? null,
    },
    {
      type: "EXPENSE",
      description: "Sinal do buffet para a formatura",
      category_id: categoryId("EXPENSE", "Buffet"),
      supplier_id: supplierId,
      amount_cents: 80000,
      occurred_on: daysAgo(20).toISOString().slice(0, 10),
      payment_method_id: pix,
    },
    {
      type: "EXPENSE",
      description: "Balões e decoração do salão",
      category_id: categoryId("EXPENSE", "Decoração"),
      amount_cents: 15000,
      occurred_on: daysAgo(15).toISOString().slice(0, 10),
      payment_method_id: dinheiro,
    },
    {
      type: "EXPENSE",
      description: "Taxa de emissão de convites impressos",
      category_id: categoryId("EXPENSE", "Convites"),
      amount_cents: 6000,
      occurred_on: daysAgo(8).toISOString().slice(0, 10),
      payment_method_id: pix,
    },
  ].map((row) => ({ ...row, origin: SEED_ORIGIN_TAG, responsible_id: createdBy, created_by: createdBy }));

  const { error } = await admin.from("financial_transactions").insert(rows);
  if (error) throw new Error("Falha ao criar lançamentos financeiros de demonstração: " + error.message);
  console.log(`${rows.length} lançamentos financeiros de demonstração criados.`);
}

async function main() {
  const raffleId = await ensureRaffle();
  await ensureSales(raffleId);
  await ensureFinancialTransactions();
  console.log("\nSeed de demonstração concluído.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
