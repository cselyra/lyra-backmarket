import { useEffect, useState, useMemo, useRef } from "react"
import { toast } from "sonner"
import { RefreshCw, Laptop, Monitor, SlidersHorizontal, X, ArrowUpDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { ItemCard } from "@/components/ItemCard"
import { ReservationModal } from "@/components/ReservationModal"
import { fetchStock, supabase } from "@/lib/api"
import type { StockItem, PcItem, ScreenItem } from "@/types"

type TabValue = "pc" | "screen"

const ALL = "all"

export function StockPage() {
  const [items, setItems] = useState<StockItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedItem, setSelectedItem] = useState<StockItem | null>(null)

  const justReservedAt = useRef<number>(0)
  const lastLoadAt = useRef<number>(Date.now())
  const wsConnected = useRef(false)
  const [countdown, setCountdown] = useState(30)
  const [wsActive, setWsActive] = useState(false)

  const [tab, setTab] = useState<TabValue>("pc")
  const [search, setSearch] = useState("")
  const [minPrice, setMinPrice] = useState("")
  const [maxPrice, setMaxPrice] = useState("")
  const [statusFilter, setStatusFilter] = useState("available")
  const [sortPrice, setSortPrice] = useState<"asc" | "desc">("asc")

  // Filtres PC
  const [ramFilter, setRamFilter] = useState(ALL)
  const [processorFilter, setProcessorFilter] = useState(ALL)
  const [storageFilter, setStorageFilter] = useState(ALL)
  const [minBattery, setMinBattery] = useState(ALL)

  // Filtres écran
  const [sizeFilter, setSizeFilter] = useState(ALL)
  const [brandFilter, setBrandFilter] = useState(ALL)

  async function load() {
    lastLoadAt.current = Date.now()
    setCountdown(30)
    setLoading(true)
    setError(null)
    try {
      setItems(await fetchStock())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    const tick = setInterval(() => {
      const elapsed = Math.floor((Date.now() - lastLoadAt.current) / 1000)
      setCountdown(Math.max(0, 30 - elapsed))
    }, 1000)
    return () => clearInterval(tick)
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      if (!wsConnected.current) load()
    }, 30_000)

    const channel = supabase
      .channel("reservations-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, (payload) => {
        load()
        if (payload.eventType === "INSERT") {
          if (Date.now() - justReservedAt.current < 5000) return
          const r = payload.new as { model?: string; item_type?: string; price?: number }
          const label = r.model ?? (r.item_type === "screen" ? "Un écran" : "Un ordinateur")
          const price = r.price != null ? ` — ${r.price} €` : ""
          toast.info(`${label}${price} vient d'être réservé. Le stock a été mis à jour automatiquement.`, { duration: 5000 })
        }
      })
      .subscribe((status) => {
        const connected = status === "SUBSCRIBED"
        wsConnected.current = connected
        setWsActive(connected)
      })

    return () => {
      clearInterval(interval)
      supabase.removeChannel(channel)
    }
  }, [])

  function handleReservationSuccess(itemId: string) {
    justReservedAt.current = Date.now()
    setItems((prev) => prev.map((i) => i.id === itemId ? { ...i, status: "reserved" as const } : i))
  }

  // Réinitialise les filtres spécifiques quand on change d'onglet
  function handleTabChange(value: TabValue) {
    setTab(value)
    setSearch(""); setMinPrice(""); setMaxPrice(""); setStatusFilter("available")
    setRamFilter(ALL); setProcessorFilter(ALL); setStorageFilter(ALL); setMinBattery(ALL)
    setSizeFilter(ALL); setBrandFilter(ALL)
  }

  const pcOptions = useMemo(() => {
    const pcs = items.filter((i): i is PcItem => i.type === "pc")
    const unique = (arr: string[]) => [...new Set(arr)].filter(Boolean).sort()
    return {
      ram: unique(pcs.map((p) => p.ram)),
      processor: unique(pcs.map((p) => normalizeProcessor(p.processor))),
      storage: unique(pcs.map((p) => p.storage)),
      battery: ["50", "60", "70", "80", "90"],
    }
  }, [items])

  const screenOptions = useMemo(() => {
    const screens = items.filter((i): i is ScreenItem => i.type === "screen")
    const unique = <T,>(arr: T[]) => [...new Set(arr)].filter(Boolean).sort() as T[]
    return {
      sizes: unique(screens.map((s) => s.size)),
      brands: unique(screens.map((s) => s.model.split(" ")[0])),
    }
  }, [items])

  const filtered = useMemo(() => {
    const result = items.filter((item) => {
      if (item.type !== tab) return false
      if (statusFilter !== ALL && item.status !== statusFilter) return false
      if (minPrice && item.price < Number(minPrice)) return false
      if (maxPrice && item.price > Number(maxPrice)) return false
      if (search) {
        const q = search.toLowerCase()
        const inModel = item.model.toLowerCase().includes(q)
        const inSn = item.serialNumber.toLowerCase().includes(q)
        const inProc = item.type === "pc" ? item.processor.toLowerCase().includes(q) : false
        if (!inModel && !inSn && !inProc) return false
      }
      if (item.type === "pc") {
        if (ramFilter !== ALL && item.ram !== ramFilter) return false
        if (processorFilter !== ALL && normalizeProcessor(item.processor) !== processorFilter) return false
        if (storageFilter !== ALL && item.storage !== storageFilter) return false
        if (minBattery !== ALL && (item.batteryHealth ?? 0) < Number(minBattery) / 100) return false
      }
      if (item.type === "screen") {
        if (sizeFilter !== ALL && item.size !== Number(sizeFilter)) return false
        if (brandFilter !== ALL && !item.model.startsWith(brandFilter)) return false
      }
      return true
    })
    result.sort((a, b) => sortPrice === "asc" ? a.price - b.price : b.price - a.price)
    return result
  }, [items, tab, search, minPrice, maxPrice, statusFilter, sortPrice, ramFilter, processorFilter, storageFilter, minBattery, sizeFilter, brandFilter])

  const counts = useMemo(() => {
    const pc = items.filter((item): item is PcItem => {
      if (item.type !== "pc") return false
      if (statusFilter !== ALL && item.status !== statusFilter) return false
      if (minPrice && item.price < Number(minPrice)) return false
      if (maxPrice && item.price > Number(maxPrice)) return false
      if (search) {
        const q = search.toLowerCase()
        if (!item.model.toLowerCase().includes(q) && !item.serialNumber.toLowerCase().includes(q) && !item.processor.toLowerCase().includes(q)) return false
      }
      if (ramFilter !== ALL && item.ram !== ramFilter) return false
      if (processorFilter !== ALL && normalizeProcessor(item.processor) !== processorFilter) return false
      if (storageFilter !== ALL && item.storage !== storageFilter) return false
      if (minBattery !== ALL && (item.batteryHealth ?? 0) < Number(minBattery) / 100) return false
      return true
    }).length

    const screen = items.filter((item): item is ScreenItem => {
      if (item.type !== "screen") return false
      if (statusFilter !== ALL && item.status !== statusFilter) return false
      if (minPrice && item.price < Number(minPrice)) return false
      if (maxPrice && item.price > Number(maxPrice)) return false
      if (search) {
        const q = search.toLowerCase()
        if (!item.model.toLowerCase().includes(q) && !item.serialNumber.toLowerCase().includes(q)) return false
      }
      if (sizeFilter !== ALL && item.size !== Number(sizeFilter)) return false
      if (brandFilter !== ALL && !item.model.startsWith(brandFilter)) return false
      return true
    }).length

    return { pc, screen, available: items.filter((i) => i.status === "available").length }
  }, [items, statusFilter, minPrice, maxPrice, search, ramFilter, processorFilter, storageFilter, minBattery, sizeFilter, brandFilter])

  const hasActiveFilters = search || minPrice || maxPrice || statusFilter !== "available" ||
    ramFilter !== ALL || processorFilter !== ALL || storageFilter !== ALL || minBattery !== ALL ||
    sizeFilter !== ALL || brandFilter !== ALL

  function resetFilters() {
    setSearch(""); setMinPrice(""); setMaxPrice(""); setStatusFilter("available")
    setRamFilter(ALL); setProcessorFilter(ALL); setStorageFilter(ALL); setMinBattery(ALL)
    setSizeFilter(ALL); setBrandFilter(ALL)
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
            <p className="text-sm text-white/70">
              {counts.available} article{counts.available > 1 ? "s" : ""} disponible{counts.available > 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-4">
        {/* Tabs */}
        <div className="flex items-center gap-2">
          {([["pc", "Ordinateurs", counts.pc], ["screen", "Écrans", counts.screen]] as [TabValue, string, number][]).map(
            ([value, label, count]) => (
              <button
                key={value}
                onClick={() => handleTabChange(value)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  tab === value
                    ? "bg-primary text-white shadow-sm"
                    : "bg-white border border-border text-foreground hover:bg-muted"
                }`}
              >
                {value === "pc" ? <Laptop className="h-4 w-4" /> : <Monitor className="h-4 w-4" />}
                {label}
                <span className={`ml-1 text-xs rounded-full px-1.5 py-0.5 ${tab === value ? "bg-white/20" : "bg-muted text-muted-foreground"}`}>
                  {count}
                </span>
              </button>
            )
          )}
          <div className="ml-auto">
            {wsActive ? (
              <span className="flex items-center gap-1.5 text-xs text-green-600">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                Actualisation en temps réel
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">Prochaine actualisation : {countdown}s</span>
            )}
          </div>
        </div>

        {/* Filtres */}
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <SlidersHorizontal className="h-4 w-4" />
            Filtres
            {hasActiveFilters && (
              <button onClick={resetFilters} className="ml-auto flex items-center gap-1 text-xs text-destructive hover:underline">
                <X className="h-3 w-3" /> Réinitialiser
              </button>
            )}
          </div>

          {/* Filtres communs */}
          <div className="flex flex-wrap gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">Recherche</span>
              <Input
                placeholder={tab === "pc" ? "Modèle, processeur, S/N…" : "Modèle, S/N…"}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-56"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">Prix (€)</span>
              <div className="flex items-center gap-1.5">
                <Input
                  type="number"
                  placeholder="Min"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  className="w-24"
                  min={0}
                />
                <span className="text-muted-foreground text-sm">—</span>
                <Input
                  type="number"
                  placeholder="Max"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  className="w-24"
                  min={0}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">Statut</span>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous statuts</SelectItem>
                  <SelectItem value="available">Disponibles</SelectItem>
                  <SelectItem value="reserved">Réservés</SelectItem>
                  <SelectItem value="sold">Vendus</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Filtres PC */}
          {tab === "pc" && (
            <>
              <Separator />
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Caractéristiques</p>
              <div className="flex flex-wrap gap-4">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-muted-foreground">Processeur</span>
                  <Select value={processorFilter} onValueChange={setProcessorFilter}>
                    <SelectTrigger className="w-52">
                      <SelectValue placeholder="Tous" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>Tous processeurs</SelectItem>
                      {pcOptions.processor.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-muted-foreground">RAM</span>
                  <Select value={ramFilter} onValueChange={setRamFilter}>
                    <SelectTrigger className="w-36">
                      <SelectValue placeholder="Toute" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>Toute RAM</SelectItem>
                      {pcOptions.ram.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-muted-foreground">Stockage</span>
                  <Select value={storageFilter} onValueChange={setStorageFilter}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Tout" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>Tout stockage</SelectItem>
                      {pcOptions.storage.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-muted-foreground">Batterie minimum</span>
                  <Select value={minBattery} onValueChange={setMinBattery}>
                    <SelectTrigger className="w-44">
                      <SelectValue placeholder="Toute" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>Toute batterie</SelectItem>
                      {pcOptions.battery.map((b) => <SelectItem key={b} value={b}>≥ {b}%</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}

          {/* Filtres écrans */}
          {tab === "screen" && (
            <>
              <Separator />
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Caractéristiques</p>
              <div className="flex flex-wrap gap-4">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-muted-foreground">Marque</span>
                  <Select value={brandFilter} onValueChange={setBrandFilter}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Toutes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>Toutes marques</SelectItem>
                      {screenOptions.brands.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-muted-foreground">Taille</span>
                  <Select value={sizeFilter} onValueChange={setSizeFilter}>
                    <SelectTrigger className="w-36">
                      <SelectValue placeholder="Toutes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>Toutes tailles</SelectItem>
                      {screenOptions.sizes.map((s) => <SelectItem key={s} value={String(s)}>{s}"</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {filtered.length} résultat{filtered.length > 1 ? "s" : ""}
          </p>
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-md border border-border overflow-hidden text-sm">
              <button
                onClick={() => setSortPrice("asc")}
                className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors ${sortPrice === "asc" ? "bg-primary text-white" : "bg-white text-foreground hover:bg-muted"}`}
              >
                <ArrowUpDown className="h-3.5 w-3.5" />
                Prix croissant
              </button>
              <div className="w-px h-full bg-border" />
              <button
                onClick={() => setSortPrice("desc")}
                className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors ${sortPrice === "desc" ? "bg-primary text-white" : "bg-white text-foreground hover:bg-muted"}`}
              >
                <ArrowUpDown className="h-3.5 w-3.5" />
                Prix décroissant
              </button>
            </div>
            <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-2">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Actualiser
            </Button>
          </div>
        </div>

        <Separator />

        {error ? (
          <div className="text-center py-16 text-destructive">
            <p className="font-medium">{error}</p>
            <Button variant="outline" className="mt-4" onClick={load}>Réessayer</Button>
          </div>
        ) : loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-64 rounded-lg bg-muted animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <p>Aucun article ne correspond à votre recherche.</p>
            {hasActiveFilters && (
              <Button variant="outline" className="mt-3" onClick={resetFilters}>Effacer les filtres</Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((item) => <ItemCard key={item.id} item={item} onReserve={setSelectedItem} />)}
          </div>
        )}
      </main>

      <ReservationModal
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        onSuccess={handleReservationSuccess}
        onReserving={() => { justReservedAt.current = Date.now() }}
        conflict={!!selectedItem && items.find((i) => i.id === selectedItem.id)?.status !== "available"}
      />
    </div>
  )
}

function normalizeProcessor(raw: string): string {
  const m = raw.match(/I(\d)\s+de\s+(\d+)/i)
  if (!m) return raw
  return `Intel Core i${m[1]} — ${m[2]}e génération`
}
