import { type NextRequest, NextResponse } from "next/server"
import { urls } from "@/config"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // Read file content
    const text = await file.text()
    let vcData: any

    // Parse JSON or extract from PDF
    if (file.type === "application/json") {
      vcData = JSON.parse(text)
    } else if (file.type === "application/pdf") {
      // Extract JSON from PDF metadata (Subject field)
      try {
        const arrayBuffer = await file.arrayBuffer()
        const { PDFDocument } = await import('pdf-lib')
        const pdfDoc = await PDFDocument.load(arrayBuffer)

        const subject = pdfDoc.getSubject()
        if (subject) {
          // Subject contains base64 encoded VC JSON
          const jsonString = Buffer.from(subject, 'base64').toString('utf-8')
          vcData = JSON.parse(jsonString)
        } else {
          return NextResponse.json({ error: "No credential data found in PDF metadata" }, { status: 400 })
        }
      } catch (e) {
        // console.error("Error parsing PDF:", e)
        return NextResponse.json({ error: "Failed to parse PDF file" }, { status: 400 })
      }
    } else {
      return NextResponse.json({ error: "Unsupported file format" }, { status: 400 })
    }

    // Proxy to verifier backend
    // Backend expects { credential: VC } format
    const response = await fetch(`${urls.verifier}/api/v1/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: vcData })
    })

    const result = await response.json()

    if (!response.ok) {
      return NextResponse.json(result, { status: response.status })
    }

    return NextResponse.json(result)
  } catch (error) {
    // console.error("Verification error:", error)
    return NextResponse.json({ error: "Verification failed" }, { status: 500 })
  }
}
