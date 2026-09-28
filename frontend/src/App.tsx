import { Navigate, Route, Routes } from "react-router-dom"
import MainLayout from "@/components/layout/MainLayout"
import About from "@/pages/About"
import Advisory from "@/pages/Advisory"
import Dashboard from "@/pages/Dashboard"
import Explorer from "@/pages/Explorer"
import History from "@/pages/History"
import Validation from "@/pages/Validation"
import Workspace from "@/pages/Workspace"

export default function App() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="workspace" element={<Workspace />} />
        <Route path="explorer" element={<Explorer />} />
        <Route path="validation" element={<Validation />} />
        <Route path="advisory" element={<Advisory />} />
        <Route path="history" element={<History />} />
        <Route path="about" element={<About />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
