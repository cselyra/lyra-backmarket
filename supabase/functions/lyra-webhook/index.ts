import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const rawBody = await req.text();

  // Lyra envoie en application/x-www-form-urlencoded (champs vads_*)
  const params = new URLSearchParams(rawBody);
  const data = Object.fromEntries(params.entries());

  const orderId = data["vads_order_id"];
  const transStatus = data["vads_trans_status"];

  console.log("Lyra IPN — orderId:", orderId, "| transStatus:", transStatus);

  if (!orderId) {
    console.error("Lyra IPN: vads_order_id absent du payload");
    return new Response("OK", { status: 200 });
  }

  // AUTHORISED = paiement autorisé (capture_delay=0 → capturé immédiatement)
  // CAPTURED   = capturé manuellement si capture_delay > 0
  if (transStatus === "AUTHORISED" || transStatus === "CAPTURED") {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const paymentMethod = resolvePaymentMethod(data);

    const { data: reservation } = await supabase
      .from("reservations")
      .select("id")
      .eq("id", orderId)
      .maybeSingle();

    if (!reservation) {
      console.error("Lyra IPN: aucune réservation pour orderId:", orderId);
      return new Response("OK", { status: 200 });
    }

    await supabase
      .from("reservations")
      .update({ status: "paid", paid_at: new Date().toISOString(), payment_method: paymentMethod })
      .eq("id", orderId);

    console.log("Réservation mise à jour:", orderId, "| paiement:", paymentMethod);
  }

  return new Response("OK", { status: 200 });
});

function resolvePaymentMethod(params: Record<string, string>): string {
  const brand = (params["vads_card_brand"] ?? "").toUpperCase();
  const src = (params["vads_payment_src"] ?? "").toUpperCase();

  if (src === "APPLE_PAY") return "Apple Pay";
  if (src === "GOOGLE_PAY") return "Google Pay";
  if (src === "SAMSUNG_PAY") return "Samsung Pay";
  if (src === "PAYPAL") return "PayPal";

  const brandLabels: Record<string, string> = {
    VISA: "Carte bancaire (Visa)",
    MASTERCARD: "Carte bancaire (Mastercard)",
    AMEX: "Carte bancaire (Amex)",
    CB: "Carte bancaire (CB)",
  };
  return brandLabels[brand] ?? brand ?? "Inconnu";
}
