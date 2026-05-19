import { createClient } from "@supabase/supabase-js"
import type { StockItem } from "@/types"

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

export async function fetchStock(): Promise<StockItem[]> {
  // Lecture directe Supabase — la RLS autorise la clé anon en SELECT
  const [{ data: items, error: stockErr }, { data: reservations, error: resErr }] =
    await Promise.all([
      supabase.from("stock_items").select("*").order("price"),
      supabase.from("reservations").select("item_id, status").in("status", ["reserved", "paid"]),
    ])

  if (stockErr) throw new Error(stockErr.message)
  if (resErr) throw new Error(resErr.message)

  const reservedMap = new Map(
    (reservations ?? []).map((r) => [
      r.item_id as string,
      r.status === "paid" ? "sold" : "reserved",
    ])
  )

  return (items ?? []).map((item) => ({
    ...snakeToCamel(item),
    status: reservedMap.get(item.id) ?? "available",
  })) as StockItem[]
}

export async function createReservation(data: {
  itemId: string
  firstName: string
  lastName: string
  email: string
}): Promise<{ reservationId: string; message: string }> {
  const { data: result, error } = await supabase.functions.invoke("create-reservation", {
    body: data,
  })
  if (error) {
    const body = await (error as { context?: Response }).context?.json?.().catch(() => null)
    throw new Error(body?.error ?? error.message)
  }
  if (result?.error) throw new Error(result.error)
  return result
}

// Convertit les colonnes snake_case de Supabase en camelCase pour le frontend
function snakeToCamel(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [
      k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()),
      v,
    ])
  )
}
