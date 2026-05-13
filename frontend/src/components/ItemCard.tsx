import { Monitor, Laptop, Calendar, HardDrive, Cpu, MemoryStick, Battery } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import type { StockItem } from "@/types"

interface Props {
  item: StockItem
  onReserve: (item: StockItem) => void
}

const statusConfig = {
  available: { label: "Disponible", className: "bg-secondary/15 text-secondary border-secondary/30" },
  reserved: { label: "Réservé", className: "bg-accent/20 text-amber-700 border-accent/40" },
  sold: { label: "Vendu", className: "bg-muted text-muted-foreground border-border" },
}

export function ItemCard({ item, onReserve }: Props) {
  const { label, className: statusClass } = statusConfig[item.status]
  const isAvailable = item.status === "available"

  return (
    <Card className={`flex flex-col transition-opacity ${!isAvailable ? "opacity-40" : ""}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            {item.type === "pc" ? (
              <Laptop className="h-5 w-5 text-muted-foreground shrink-0" />
            ) : (
              <Monitor className="h-5 w-5 text-muted-foreground shrink-0" />
            )}
            <CardTitle className="text-base leading-tight">{item.model}</CardTitle>
          </div>
          <Badge className={`shrink-0 border ${statusClass}`}>{label}</Badge>
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-2 text-sm text-muted-foreground">
        {item.type === "pc" ? (
          <>
            <div className="flex items-center gap-1.5">
              <Cpu className="h-3.5 w-3.5 shrink-0" />
              <span>{item.processor}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <MemoryStick className="h-3.5 w-3.5 shrink-0" />
              <span>{item.ram}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <HardDrive className="h-3.5 w-3.5 shrink-0" />
              <span>{item.storage}</span>
            </div>
            {item.batteryHealth != null && (
              <div className="flex items-center gap-1.5">
                <Battery className="h-3.5 w-3.5 shrink-0" />
                <span>Batterie : {Math.round(item.batteryHealth * 100)}%</span>
              </div>
            )}
            {item.warrantyEnd && (
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 shrink-0" />
                <span>Garantie jusqu'au {formatDate(item.warrantyEnd)}</span>
              </div>
            )}
            {item.exteriorCondition && (
              <div className="text-xs">
                État : <span className="text-foreground font-medium">{item.exteriorCondition}</span>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center gap-1.5">
              <Monitor className="h-3.5 w-3.5 shrink-0" />
              <span>{item.size}"</span>
            </div>
          </>
        )}

        {item.comment && (
          <p className="text-xs italic border-l-2 border-muted pl-2 mt-1">{item.comment}</p>
        )}

        <p className="text-xs font-mono text-muted-foreground/70">S/N : {item.serialNumber}</p>
      </CardContent>

      <CardFooter className="pt-4 flex items-center justify-between">
        <span className="text-2xl font-bold">{item.price} €</span>
        <Button
          onClick={() => onReserve(item)}
          disabled={!isAvailable}
          size="sm"
        >
          {isAvailable ? "Réserver" : item.status === "reserved" ? "Déjà réservé" : "Vendu"}
        </Button>
      </CardFooter>
    </Card>
  )
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-")
  return `${d}/${m}/${y}`
}
