import { Toaster } from "sonner"
import { StockPage } from "@/pages/StockPage"
import { ReservationPage } from "@/pages/ReservationPage"
import { EligibilityModal } from "@/components/EligibilityModal"

export default function App() {
  if (new URLSearchParams(window.location.search).get("page") === "ma-reservation") {
    return <ReservationPage />
  }

  return (
    <>
      <EligibilityModal />
      <StockPage />
      <Toaster position="bottom-right" richColors />
    </>
  )
}
