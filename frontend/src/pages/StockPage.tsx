import { useEffect, useState, useMemo } from "react"
import { RefreshCw, Laptop, Monitor, SlidersHorizontal, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { ItemCard } from "@/components/ItemCard"
import { ReservationModal } from "@/components/ReservationModal"
import { fetchStock } from "@/lib/api"
import type { StockItem, PcItem, ScreenItem } from "@/types"

type TabValue = "pc" | "screen"

const ALL = "all"

export function StockPage() {
  const [items, setItems] = useState<StockItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedItem, setSelectedItem] = useState<StockItem | null>(null)

  const [tab, setTab] = useState<TabValue>("pc")
  const [search, setSearch] = useState("")
  const [maxPrice, setMaxPrice] = useState("")
  const [statusFilter, setStatusFilter] = useState("available")

  // Filtres PC
  const [ramFilter, setRamFilter] = useState(ALL)
  const [processorFilter, setProcessorFilter] = useState(ALL)
  const [storageFilter, setStorageFilter] = useState(ALL)
  const [minBattery, setMinBattery] = useState(ALL)

  // Filtres écran
  const [sizeFilter, setSizeFilter] = useState(ALL)
  const [brandFilter, setBrandFilter] = useState(ALL)

  async function load() {
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

  function handleReservationSuccess(itemId: string) {
    setItems((prev) => prev.map((i) => i.id === itemId ? { ...i, status: "reserved" as const } : i))
  }

  // Réinitialise les filtres spécifiques quand on change d'onglet
  function handleTabChange(value: TabValue) {
    setTab(value)
    setSearch(""); setMaxPrice(""); setStatusFilter("available")
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
    return items.filter((item) => {
      if (item.type !== tab) return false
      if (statusFilter !== ALL && item.status !== statusFilter) return false
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
  }, [items, tab, search, maxPrice, statusFilter, ramFilter, processorFilter, storageFilter, minBattery, sizeFilter, brandFilter])

  const counts = useMemo(() => ({
    pc: items.filter((i) => i.type === "pc").length,
    screen: items.filter((i) => i.type === "screen").length,
    available: items.filter((i) => i.status === "available").length,
  }), [items])

  const hasActiveFilters = search || maxPrice || statusFilter !== "available" ||
    ramFilter !== ALL || processorFilter !== ALL || storageFilter !== ALL || minBattery !== ALL ||
    sizeFilter !== ALL || brandFilter !== ALL

  function resetFilters() {
    setSearch(""); setMaxPrice(""); setStatusFilter("available")
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
        <div className="flex gap-2">
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
          <div className="flex flex-wrap gap-3">
            <Input
              placeholder={tab === "pc" ? "Modèle, processeur, S/N…" : "Modèle, S/N…"}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-56"
            />
            <Input
              type="number"
              placeholder="Prix max (€)"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              className="w-32"
              min={0}
            />
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

          {/* Filtres PC */}
          {tab === "pc" && (
            <>
              <Separator />
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Caractéristiques</p>
              <div className="flex flex-wrap gap-3">
                <Select value={processorFilter} onValueChange={setProcessorFilter}>
                  <SelectTrigger className="w-52">
                    <SelectValue placeholder="Processeur" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Tous processeurs</SelectItem>
                    {pcOptions.processor.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>

                <Select value={ramFilter} onValueChange={setRamFilter}>
                  <SelectTrigger className="w-36">
                    <SelectValue placeholder="RAM" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Toute RAM</SelectItem>
                    {pcOptions.ram.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>

                <Select value={storageFilter} onValueChange={setStorageFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Stockage" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Tout stockage</SelectItem>
                    {pcOptions.storage.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>

                <Select value={minBattery} onValueChange={setMinBattery}>
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder="Batterie min." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Toute batterie</SelectItem>
                    {pcOptions.battery.map((b) => <SelectItem key={b} value={b}>≥ {b}%</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {/* Filtres écrans */}
          {tab === "screen" && (
            <>
              <Separator />
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Caractéristiques</p>
              <div className="flex flex-wrap gap-3">
                <Select value={brandFilter} onValueChange={setBrandFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Marque" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Toutes marques</SelectItem>
                    {screenOptions.brands.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                  </SelectContent>
                </Select>

                <Select value={sizeFilter} onValueChange={setSizeFilter}>
                  <SelectTrigger className="w-36">
                    <SelectValue placeholder="Taille" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Toutes tailles</SelectItem>
                    {screenOptions.sizes.map((s) => <SelectItem key={s} value={String(s)}>{s}"</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {filtered.length} résultat{filtered.length > 1 ? "s" : ""}
          </p>
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-2">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Actualiser
          </Button>
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
      />
    </div>
  )
}

function normalizeProcessor(raw: string): string {
  const m = raw.match(/I(\d)\s+de\s+(\d+)/i)
  if (!m) return raw
  return `Intel Core i${m[1]} — ${m[2]}e génération`
}
