"use client"

import { Code, Copy, CheckCircle, Download } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useState } from "react"
import type { VerifiableCredential } from "@/lib/types/vc"

interface VCRawJsonProps {
  vc: VerifiableCredential
}

export function VCRawJson({ vc }: VCRawJsonProps) {
  const [copied, setCopied] = useState(false)

  const jsonString = JSON.stringify(vc, null, 2)

  const copyJson = async () => {
    await navigator.clipboard.writeText(jsonString)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const downloadJson = () => {
    const blob = new Blob([jsonString], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `credential-${vc.id || "export"}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Code className="h-5 w-5 text-primary" />
            JSON Raw
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={copyJson}>
              {copied ? <CheckCircle className="h-4 w-4 mr-1 text-green-500" /> : <Copy className="h-4 w-4 mr-1" />}
              {copied ? "Copiado" : "Copiar"}
            </Button>
            <Button variant="outline" size="sm" onClick={downloadJson}>
              <Download className="h-4 w-4 mr-1" />
              Descargar
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <pre className="p-4 bg-muted/50 rounded-lg overflow-x-auto text-xs font-mono max-h-[500px] overflow-y-auto">
          {jsonString}
        </pre>
      </CardContent>
    </Card>
  )
}
