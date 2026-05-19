import { useState } from "react"
import { ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"

const STORAGE_KEY = "cse-eligibility-accepted"

const RULES = [
  "Je suis en CDI chez Lyra Network.",
  "Je ne suis pas en période d'essai.",
  "Je ne suis pas en préavis de départ.",
  "Je n'effectuerai qu'une seule commande.",
  "J'ai au moins 1 an d'ancienneté chez Lyra Network.",
]

export function EligibilityModal() {
  const [open, setOpen] = useState(() => localStorage.getItem(STORAGE_KEY) !== "true")
  const [checked, setChecked] = useState<boolean[]>(RULES.map(() => false))

  const allChecked = checked.every(Boolean)

  function toggle(index: number) {
    setChecked((prev) => prev.map((v, i) => (i === index ? !v : v)))
  }

  function handleAccept() {
    localStorage.setItem(STORAGE_KEY, "true")
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-lg"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex justify-center mb-2">
            <ShieldCheck className="h-10 w-10 text-primary" />
          </div>
          <DialogTitle className="text-center text-lg">Conditions d'éligibilité</DialogTitle>
          <DialogDescription className="text-center">
            Avant d'accéder à la vente, veuillez confirmer que vous remplissez toutes les conditions suivantes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {RULES.map((rule, i) => (
            <label key={i} className="flex items-start gap-3 cursor-pointer group">
              <div className="relative mt-0.5 shrink-0">
                <input
                  type="checkbox"
                  checked={checked[i]}
                  onChange={() => toggle(i)}
                  className="peer h-4 w-4 cursor-pointer appearance-none rounded border border-input bg-background checked:bg-primary checked:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                {checked[i] && (
                  <svg className="pointer-events-none absolute inset-0 h-4 w-4 text-primary-foreground" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8l3.5 3.5L13 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">{rule}</span>
            </label>
          ))}
        </div>

        <Button onClick={handleAccept} disabled={!allChecked} className="w-full mt-2">
          J'atteste sur l'honneur respecter ces conditions
        </Button>
      </DialogContent>
    </Dialog>
  )
}
