import type React from "react"
import { AdminAuthGate } from "@/components/admin-auth-gate"
import { AdminLayout } from "@/components/admin/admin-layout"

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AdminAuthGate>
      <AdminLayout>{children}</AdminLayout>
    </AdminAuthGate>
  )
}
