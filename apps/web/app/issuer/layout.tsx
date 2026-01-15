import type React from "react"
import { IssuerAuthGate } from "@/components/issuer-auth-gate"

export default function IssuerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <IssuerAuthGate>{children}</IssuerAuthGate>
}
