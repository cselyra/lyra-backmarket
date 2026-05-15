import { createClient } from "jsr:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  Deno.env.get("FRONTEND_URL"),
  "http://localhost:5173",
].filter(Boolean) as string[];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  try {
    const { itemId, firstName, lastName, email } = await req.json();

    if (!itemId || !firstName || !lastName || !email) {
      return json({ error: "Champs manquants" }, 400);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: "Email invalide" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: item, error: itemErr } = await supabase
      .from("stock_items")
      .select("*")
      .eq("id", itemId)
      .single();

    if (itemErr || !item) return json({ error: "Article introuvable" }, 404);

    const { data: existing } = await supabase
      .from("reservations")
      .select("id")
      .eq("item_id", item.id)
      .in("status", ["reserved", "paid"])
      .maybeSingle();

    if (existing) return json({ error: "Cet article n'est plus disponible" }, 409);

    const reservationId = `RES-${Date.now()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;

    const { error: insertErr } = await supabase.from("reservations").insert({
      id: reservationId,
      item_id: item.id,
      item_type: item.type,
      serial_number: item.serial_number,
      model: item.model,
      price: item.price,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      email: email.trim().toLowerCase(),
      status: "reserved",
    });

    if (insertErr) throw insertErr;

    const lyraResult = await createLyraPaymentOrder({
      reservationId,
      amount: item.price,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim().toLowerCase(),
    });

    if (lyraResult) {
      await supabase
        .from("reservations")
        .update({ lyra_order_id: lyraResult.orderId, payment_url: lyraResult.paymentUrl })
        .eq("id", reservationId);
    }

    return json({ reservationId, message: "Réservation enregistrée. Un lien de paiement vous a été envoyé par email." });
  } catch (err) {
    console.error(err);
    return json({ error: "Erreur serveur" }, 500);
  }
});

async function createLyraPaymentOrder(params: {
  reservationId: string;
  amount: number;
  firstName: string;
  lastName: string;
  email: string;
}) {
  const shopId = Deno.env.get("LYRA_SHOP_ID");
  const key = Deno.env.get("LYRA_KEY");
  const baseUrl = Deno.env.get("LYRA_BASE_URL") ?? "https://api.payzen.eu";

  if (!shopId || !key) {
    console.error("Lyra: LYRA_SHOP_ID ou LYRA_KEY manquant");
    return null;
  }

  const credentials = btoa(`${shopId}:${key}`);

  const res = await fetch(`${baseUrl}/api-payment/V4/PaymentOrder/Create`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: Math.round(params.amount * 100),
      currency: "EUR",
      orderId: params.reservationId,
      customer: {
        email: params.email,
        billingDetails: { firstName: params.firstName, lastName: params.lastName },
      },
      channelOptions: {
        channelType: "MAIL",
        mailOptions: { recipient: params.email },
      },
      expirationDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      ...(Deno.env.get("LYRA_IPN_URL") ? { ipnTargetUrl: Deno.env.get("LYRA_IPN_URL") } : {}),
    }),
  });

  const data = await res.json();
  console.log("Lyra API status HTTP:", res.status);
  console.log("Lyra API response:", JSON.stringify(data));

  if (!res.ok || data.status !== "SUCCESS") return null;

  return {
    orderId: data.answer.paymentOrderId as string,
    paymentUrl: data.answer.paymentURL as string,
  };
}
