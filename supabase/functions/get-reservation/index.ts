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

  const url = new URL(req.url);
  const reservationId = url.searchParams.get("id")?.trim().toUpperCase();

  if (!reservationId) {
    return json({ error: "Numéro de réservation manquant" }, 400);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data, error } = await supabase
    .from("reservations")
    .select("id, status, first_name, last_name, item_type, model, serial_number, price, payment_url, created_at, paid_at, payment_method")
    .eq("id", reservationId)
    .maybeSingle();

  if (error) {
    console.error(error);
    return json({ error: "Erreur serveur" }, 500);
  }

  if (!data) {
    return json({ error: "Réservation introuvable" }, 404);
  }

  return json(data);
});
