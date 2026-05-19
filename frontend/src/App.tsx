import { Toaster } from "sonner"
import { StockPage } from "@/pages/StockPage"
import { EligibilityModal } from "@/components/EligibilityModal"

export default function App() {
  return (
    <>
      <EligibilityModal />
      <StockPage />
      <Toaster position="bottom-right" richColors />
    </>
  )
}
