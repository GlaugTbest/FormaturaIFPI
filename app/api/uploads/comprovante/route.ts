import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_UPLOAD_LIMITS } from "@/lib/uploads";

const MAGIC_BYTES: Array<{ mime: string; check: (bytes: Uint8Array) => boolean }> = [
  { mime: "image/jpeg", check: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    mime: "image/png",
    check: (b) =>
      b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  },
  {
    mime: "image/webp",
    check: (b) =>
      b[0] === 0x52 &&
      b[1] === 0x49 &&
      b[2] === 0x46 &&
      b[3] === 0x46 &&
      b[8] === 0x57 &&
      b[9] === 0x45 &&
      b[10] === 0x42 &&
      b[11] === 0x50,
  },
  {
    mime: "application/pdf",
    check: (b) => b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46,
  },
];

function sniffMimeType(bytes: Uint8Array): string | null {
  return MAGIC_BYTES.find((m) => m.check(bytes))?.mime ?? null;
}

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  const admin = createAdminClient();
  const { error: rateLimitError } = await admin.rpc("check_rate_limit", {
    p_bucket: "upload_comprovante",
    p_identifier: ip,
    p_max_events: 15,
    p_window_seconds: 60,
  });
  if (rateLimitError) {
    return NextResponse.json(
      { error: "Muitas tentativas em pouco tempo. Aguarde um instante." },
      { status: 429 },
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Arquivo não enviado." }, { status: 400 });
  }

  if (file.size === 0) {
    return NextResponse.json({ error: "Arquivo vazio." }, { status: 400 });
  }

  if (file.size > DEFAULT_UPLOAD_LIMITS.maxSizeBytes) {
    return NextResponse.json(
      {
        error: `Arquivo muito grande. O limite é ${Math.round(DEFAULT_UPLOAD_LIMITS.maxSizeBytes / 1024 / 1024)}MB.`,
      },
      { status: 400 },
    );
  }

  const buffer = new Uint8Array(await file.arrayBuffer());
  const sniffedMime = sniffMimeType(buffer);

  if (!sniffedMime || !DEFAULT_UPLOAD_LIMITS.allowedMimeTypes.includes(sniffedMime)) {
    return NextResponse.json(
      { error: "Tipo de arquivo não permitido. Envie uma imagem (JPG, PNG, WEBP) ou PDF." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const extension = sniffedMime.split("/")[1];
  const storagePath = `raffle-sales/${randomUUID()}.${extension}`;

  const { error: uploadError } = await admin.storage
    .from("attachments")
    .upload(storagePath, buffer, { contentType: sniffedMime });

  if (uploadError) {
    return NextResponse.json(
      { error: "Não foi possível enviar o arquivo. Tente novamente." },
      { status: 502 },
    );
  }

  const { data: attachment, error: insertError } = await admin
    .from("attachments")
    .insert({
      entity_type: "raffle_sale",
      entity_id: null,
      kind: "comprovante",
      status: "UPLOADED",
      temp_storage_path: storagePath,
      file_name: file.name || `comprovante.${extension}`,
      mime_type: sniffedMime,
      file_size: file.size,
      uploaded_by: user?.id ?? null,
    })
    .select("id")
    .single();

  if (insertError) {
    await admin.storage.from("attachments").remove([storagePath]);
    return NextResponse.json(
      { error: "Não foi possível registrar o comprovante." },
      { status: 500 },
    );
  }

  return NextResponse.json({ attachmentId: attachment.id });
}
