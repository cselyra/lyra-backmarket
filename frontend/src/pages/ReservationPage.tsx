import { useEffect, useRef, useState } from "react"
import { Search, Laptop, Monitor, CreditCard, CheckCircle2, Clock, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { getReservation } from "@/lib/api"
import type { Reservation, ReservationSpecs } from "@/types"

const STATUS_LABEL: Record<string, string> = {
  reserved: "En attente de paiement",
  paid: "Payé",
  cancelled: "Annulé",
}

const STATUS_VARIANT: Record<string, "warning" | "success" | "destructive" | "muted"> = {
  reserved: "warning",
  paid: "success",
  cancelled: "destructive",
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso))
}

export function ReservationPage() {
  const [reservationId, setReservationId] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reservation, setReservation] = useState<Reservation | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const id = params.get("id")
    if (id) {
      setReservationId(id.toUpperCase())
      handleLookup(id)
    } else {
      inputRef.current?.focus()
    }
  }, [])

  async function handleLookup(id?: string) {
    const query = (id ?? reservationId).trim()
    if (!query) return
    setLoading(true)
    setError(null)
    setReservation(null)
    try {
      const res = await getReservation(query)
      setReservation(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary shadow-md">
        <div className="max-w-7xl mx-auto px-6 py-5 flex flex-col sm:flex-row items-center gap-4">
          <img
            src={`${import.meta.env.BASE_URL}assets/logo-cse.svg`}
            alt="Logo CSE"
            className="h-14 object-contain"
          />
          <div className="hidden sm:block w-px h-12 bg-white/25" />
          <img
            src={`${import.meta.env.BASE_URL}assets/logo-lyra-backmarket.png`}
            alt="Lyra × Back Market"
            className="h-8 object-contain brightness-0 invert"
          />
          <div className="sm:ml-auto text-center sm:text-right">
            <h1 className="text-lg font-bold text-white leading-tight">Vente Matériel Informatique</h1>
            <p className="text-sm text-white/70">Suivi de réservation</p>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-10 space-y-6">
        {/* Recherche */}
        <div className="rounded-lg border bg-card p-6 space-y-4">
          <div className="space-y-1">
            <h2 className="text-base font-semibold">Ma réservation</h2>
            <p className="text-sm text-muted-foreground">
              Entrez le numéro de réservation reçu par email (ex. RES-1234567890-AB1234).
            </p>
          </div>
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              placeholder="RES-…"
              value={reservationId}
              onChange={(e) => setReservationId(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && handleLookup()}
              className="font-mono text-sm"
            />
            <Button onClick={() => handleLookup()} disabled={loading || !reservationId.trim()}>
              <Search className="h-4 w-4" />
            </Button>
          </div>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        {/* Résultat */}
        {reservation && <ReservationCard reservation={reservation} />}
      </main>
    </div>
  )
}

function ReservationCard({ reservation: r }: { reservation: Reservation }) {
  const ItemIcon = r.itemType === "pc" ? Laptop : Monitor
  const itemLabel = r.itemType === "pc" ? "Ordinateur" : "Écran"

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      {/* En-tête statut */}
      <div className="px-6 py-4 border-b flex items-center justify-between gap-4">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Réservation</p>
          <p className="font-mono text-sm font-medium">{r.id}</p>
        </div>
        <Badge variant={STATUS_VARIANT[r.status] ?? "muted"}>
          {r.status === "paid"
            ? <><CheckCircle2 className="h-3 w-3 mr-1" />{STATUS_LABEL[r.status]}</>
            : r.status === "reserved"
            ? <><Clock className="h-3 w-3 mr-1" />{STATUS_LABEL[r.status]}</>
            : STATUS_LABEL[r.status]
          }
        </Badge>
      </div>

      <div className="px-6 py-5 space-y-5">
        {/* Acheteur */}
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Acheteur</p>
          <p className="font-medium">{r.firstName} {r.lastName}</p>
        </div>

        {/* Article */}
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Article</p>
          <div className="rounded-md border bg-muted/40 p-3 space-y-3">
            <div className="flex items-start gap-3">
              <ItemIcon className="h-5 w-5 mt-0.5 text-muted-foreground shrink-0" />
              <div className="space-y-0.5">
                <p className="text-sm font-medium leading-tight">{r.model}</p>
                <p className="text-xs text-muted-foreground">{itemLabel} · S/N {r.serialNumber}</p>
                <p className="text-sm font-semibold text-primary">{r.price} €</p>
              </div>
            </div>
            {r.specs && <SpecsGrid type={r.itemType} specs={r.specs} />}
          </div>
        </div>

        {/* Dates */}
        <div className="space-y-1.5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Dates</p>
          <div className="text-sm space-y-1">
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Réservé le</span>
              <span className="font-medium text-right">{formatDate(r.createdAt)}</span>
            </div>
            {r.paidAt && (
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Payé le</span>
                <span className="font-medium text-right">{formatDate(r.paidAt)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Paiement */}
        {r.status === "paid" && r.paymentMethod && (
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Paiement</p>
            <div className="flex items-center gap-2 text-sm">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <span>{r.paymentMethod}</span>
            </div>
          </div>
        )}

        {r.status === "reserved" && r.paymentUrl && (
          <a href={r.paymentUrl} target="_blank" rel="noopener noreferrer">
            <Button className="w-full gap-2">
              <CreditCard className="h-4 w-4" />
              Procéder au paiement
              <ExternalLink className="h-3.5 w-3.5 ml-auto" />
            </Button>
          </a>
        )}

        {r.status === "reserved" && !r.paymentUrl && (
          <p className="text-sm text-muted-foreground rounded-md border bg-muted/40 p-3">
            Le lien de paiement vous a été envoyé par email. Vérifiez votre boîte de réception.
          </p>
        )}
      </div>
    </div>
  )
}

function SpecsGrid({ type, specs }: { type: "pc" | "screen"; specs: ReservationSpecs }) {
  const rows: { label: string; value: string }[] = []

  if (type === "pc") {
    if (specs.processor) rows.push({ label: "Processeur", value: normalizeProcessor(specs.processor) })
    if (specs.ram) rows.push({ label: "RAM", value: specs.ram })
    if (specs.storage) rows.push({ label: "Stockage", value: specs.storage })
    if (specs.batteryHealth != null) rows.push({ label: "Batterie", value: `${Math.round(specs.batteryHealth * 100)} %` })
    if (specs.exteriorCondition) rows.push({ label: "État extérieur", value: specs.exteriorCondition })
  } else {
    if (specs.size) rows.push({ label: "Taille", value: `${specs.size}"` })
  }

  if (rows.length === 0) return null

  return (
    <div className="border-t pt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
      {rows.map(({ label, value }) => (
        <div key={label} className="contents">
          <span className="text-xs text-muted-foreground">{label}</span>
          <span className="text-xs font-medium">{value}</span>
        </div>
      ))}
    </div>
  )
}

function normalizeProcessor(raw: string): string {
  const m = raw.match(/I(\d)\s+de\s+(\d+)/i)
  if (!m) return raw
  return `Intel Core i${m[1]} — ${m[2]}e génération`
}
