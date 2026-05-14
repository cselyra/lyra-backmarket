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

  // LOG TEMPORAIRE — à supprimer après avoir identifié la structure du payload
  console.log("LYRA WEBHOOK PAYLOAD:", JSON.stringify(data, null, 2));

  const clientAnswer = (data.clientAnswer ?? {}) as Record<string, unknown>;
  const orderDetails = (clientAnswer.orderDetails ?? {}) as Record<string, unknown>;
  const orderStatus = clientAnswer.orderStatus as string | undefined;

  // Lyra peut renvoyer notre orderId à différents endroits selon la version de l'API
  const orderId = (clientAnswer.orderId ?? orderDetails.orderId) as string | undefined;

  console.log("orderId résolu:", orderId, "| orderStatus:", orderStatus);
  console.log("clientAnswer keys:", Object.keys(clientAnswer));

  if (!orderId) {
    console.error("Webhook Lyra: orderId introuvable dans le payload");
    return new Response("OK", { status: 200 });
  }

  if (orderStatus === "PAID") {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const transactions = (clientAnswer.transactions ?? []) as Record<string, unknown>[];
    const paymentMethod = resolvePaymentMethod(transactions[0]);

    // Tentative 1 : notre reservationId (RES-xxx) envoyé comme orderId à Lyra
    const { data: byOurId } = await supabase
      .from("reservations")
      .select("id")
      .eq("id", orderId)
      .maybeSingle();

    // Tentative 2 : l'ID interne Lyra stocké dans lyra_order_id
    const { data: byLyraId } = !byOurId ? await supabase
      .from("reservations")
      .select("id")
      .eq("lyra_order_id", orderId)
      .maybeSingle() : { data: null };

    const reservationId = byOurId?.id ?? byLyraId?.id;

    if (!reservationId) {
      console.error("Webhook Lyra: aucune réservation trouvée pour orderId:", orderId);
      return new Response("OK", { status: 200 });
    }

    await supabase
      .from("reservations")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        payment_method: paymentMethod,
      })
      .eq("id", reservationId);

    console.log("Réservation mise à jour:", reservationId, "| moyen de paiement:", paymentMethod);
  }

  return new Response("OK", { status: 200 });
});

function resolvePaymentMethod(transaction?: Record<string, unknown>): string {
  if (!transaction) return "Inconnu";

  const methodType = (transaction.paymentMethodType as string ?? "").toUpperCase();
  const brand = ((transaction.brand ?? transaction.cardNetwork) as string ?? "").toUpperCase();

  const methodLabels: Record<string, string> = {
    APPLE_PAY: "Apple Pay",
    GOOGLE_PAY: "Google Pay",
    SAMSUNG_PAY: "Samsung Pay",
    PAYPAL: "PayPal",
  };
  if (methodLabels[methodType]) return methodLabels[methodType];

  if (methodType === "CARD") {
    const brandLabels: Record<string, string> = {
      VISA: "Carte bancaire (Visa)",
      MASTERCARD: "Carte bancaire (Mastercard)",
      AMEX: "Carte bancaire (Amex)",
      CB: "Carte bancaire (CB)",
    };
    return brandLabels[brand] ?? "Carte bancaire";
  }

  // Fallback : on log pour identifier les cas non couverts
  console.warn("resolvePaymentMethod: type non reconnu →", JSON.stringify(transaction));
  return methodType || "Inconnu";
}
