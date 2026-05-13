export type ItemType = "pc" | "screen"
export type ItemStatus = "available" | "reserved" | "sold"

export interface PcItem {
  id: string
  type: "pc"
  model: string
  processor: string
  ram: string
  storage: string
  serialNumber: string
  exteriorCondition: string
  batteryHealth: number | null
  warrantyEnd: string | null
  comment: string | null
  price: number
  status: ItemStatus
}

export interface ScreenItem {
  id: string
  type: "screen"
  model: string
  serialNumber: string
  size: number
  comment: string | null
  price: number
  status: ItemStatus
}

export type StockItem = PcItem | ScreenItem
