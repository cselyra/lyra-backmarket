import { Toaster } from "sonner"
import { StockPage } from "@/pages/StockPage"

export default function App() {
  return (
    <>
      <StockPage />
      <Toaster position="bottom-right" richColors />
    </>
  )
}
