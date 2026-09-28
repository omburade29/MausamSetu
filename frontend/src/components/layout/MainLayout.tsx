import { Outlet } from "react-router-dom"
import Disclaimer from "@/components/Disclaimer"
import Header from "@/components/layout/Header"
import Sidebar from "@/components/layout/Sidebar"

export default function MainLayout() {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-5 md:px-6">
          <Outlet />
        </main>
        <footer className="border-t border-slate-200 bg-white px-4 py-4 md:px-6">
          <Disclaimer compact />
        </footer>
      </div>
    </div>
  )
}
