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

export type ReservationStatus = "reserved" | "paid" | "cancelled"

export interface ReservationSpecs {
  processor?: string | null
  ram?: string | null
  storage?: string | null
  batteryHealth?: number | null
  exteriorCondition?: string | null
  warrantyEnd?: string | null
  size?: number | null
}

export interface Reservation {
  id: string
  status: ReservationStatus
  firstName: string
  lastName: string
  itemType: "pc" | "screen"
  model: string
  serialNumber: string
  price: number
  paymentUrl: string | null
  createdAt: string
  paidAt: string | null
  paymentMethod: string | null
  specs: ReservationSpecs | null
}
