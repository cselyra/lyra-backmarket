import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const rawBody = await req.text();

  // Vérification signature HMAC-SHA256 Lyra
  const receivedHash = req.headers.get("kr-hash");
  const webhookSecret = Deno.env.get("LYRA_WEBHOOK_SECRET");

  if (receivedHash && webhookSecret) {
    const keyData = new TextEncoder().encode(webhookSecret);
    const msgData = new TextEncoder().encode(rawBody);
    const cryptoKey = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const sig = await crypto.subtle.sign("HMAC", cryptoKey, msgData);
    const computedHash = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");

    if (computedHash !== receivedHash) {
      console.warn("Webhook Lyra: signature invalide");
      return new Response("Forbidden", { status: 403 });
    }
  }

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(rawBody);
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const clientAnswer = (data.clientAnswer ?? {}) as Record<string, unknown>;
  const orderStatus = clientAnswer.orderStatus as string | undefined;
  const orderId = clientAnswer.orderId as string | undefined;

  if (!orderId) return new Response("OK", { status: 200 });

  if (orderStatus === "PAID") {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    await supabase
      .from("reservations")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", orderId);
  }

  return new Response("OK", { status: 200 });
});
