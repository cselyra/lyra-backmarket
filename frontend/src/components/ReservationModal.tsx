import { useState } from "react"
import { Loader2, Mail, CheckCircle2, Clock, AlertTriangle, Ban } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createReservation } from "@/lib/api"
import type { StockItem } from "@/types"

interface Props {
  item: StockItem | null
  onClose: () => void
  onSuccess: (itemId: string) => void
  onReserving: () => void
  conflict?: boolean
}

export function ReservationModal({ item, onClose, onSuccess, onReserving, conflict }: Props) {
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [understood, setUnderstood] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  if (!item) return null

  const itemLabel = item.type === "pc" ? item.model : `${item.model} ${(item as { size?: number }).size ?? ""}"`
  const isValid = firstName.trim() && lastName.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && understood

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValid || !item) return
    setLoading(true)
    setError(null)
    onReserving()
    try {
      await createReservation({ itemId: item.id, firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim() })
      setDone(true)
      onSuccess(item.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue")
    } finally {
      setLoading(false)
    }
  }

  function handleClose() {
    setFirstName("")
    setLastName("")
    setEmail("")
    setUnderstood(false)
    setError(null)
    setDone(false)
    onClose()
  }

  return (
    <Dialog open={!!item} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        {done ? (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
            <DialogHeader>
              <DialogTitle>Réservation confirmée !</DialogTitle>
              <DialogDescription>
                Un lien de paiement a été envoyé à <strong>{email}</strong>.<br />
                L'article est bloqué pour vous pendant 24h.
              </DialogDescription>
            </DialogHeader>
            <Button onClick={handleClose} className="w-full">Fermer</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Réserver — {itemLabel}</DialogTitle>
              <DialogDescription>
                Prix : <strong>{item.price} €</strong>. Renseignez vos coordonnées pour recevoir le lien de paiement par email.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="firstName">Prénom</Label>
                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Jean"
                    required
                    disabled={loading}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="lastName">Nom</Label>
                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Dupont"
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jean.dupont@email.fr"
                  required
                  disabled={loading}
                />
              </div>

              {/* Alerte expiration */}
              <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <Clock className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
                <p>
                  <strong>Réservation valable 24h.</strong> Si le paiement n'est pas effectué dans ce délai, la réservation expirera automatiquement et l'article sera de nouveau disponible pour d'autres acheteurs.
                </p>
              </div>

              {/* Case à cocher */}
              <label className="flex items-start gap-3 cursor-pointer group">
                <div className="relative mt-0.5 shrink-0">
                  <input
                    type="checkbox"
                    checked={understood}
                    onChange={(e) => setUnderstood(e.target.checked)}
                    disabled={loading}
                    className="peer h-4 w-4 cursor-pointer appearance-none rounded border border-input bg-background checked:bg-primary checked:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  {understood && (
                    <svg className="pointer-events-none absolute inset-0 h-4 w-4 text-primary-foreground" viewBox="0 0 16 16" fill="none">
                      <path d="M3 8l3.5 3.5L13 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                  Je comprends que ma réservation expirera après <strong className="text-foreground">24 heures</strong> si le paiement n'est pas complété.
                </span>
              </label>

              {conflict && !done && (
                <div className="flex gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  <Ban className="h-4 w-4 shrink-0 mt-0.5" />
                  <p><strong>Cet article vient d'être réservé par quelqu'un d'autre.</strong> Vous ne pouvez plus effectuer cette réservation.</p>
                </div>
              )}

              {error && (
                <div className="flex gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  {error}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
                Annuler
              </Button>
              <Button type="submit" disabled={!isValid || loading || !!conflict}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Envoi…
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Réserver & recevoir le lien
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
