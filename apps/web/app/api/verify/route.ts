import { type NextRequest, NextResponse } from "next/server"
import { urls } from "@/config"

function detectVerificationPayload(document: any) {
  const types = Array.isArray(document?.type) ? document.type : [document?.type].filter(Boolean)

  if (document?.verifiableCredential || types.includes("VerifiablePresentation")) {
    return { kind: "presentation" as const, data: document }
  }

  return { kind: "credential" as const, data: document }
}

function normalizeVerificationPayload(input: any) {
  if (!input || typeof input !== "object") {
    throw new Error("Invalid credential JSON format")
  }

  if (input.presentation && typeof input.presentation === "object") {
    return detectVerificationPayload(input.presentation)
  }

  if (input.credential && typeof input.credential === "object") {
    return detectVerificationPayload(input.credential)
  }

  if (input.vc && typeof input.vc === "object") {
    return detectVerificationPayload(input.vc)
  }

  return detectVerificationPayload(input)
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // Read file content
    const text = await file.text()
    let parsedData: any

    // Parse JSON or extract from PDF
    if (file.type === "application/json") {
      parsedData = JSON.parse(text)
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
          parsedData = JSON.parse(jsonString)
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

    const verificationPayload = normalizeVerificationPayload(parsedData)
    const endpoint = verificationPayload.kind === "presentation"
      ? `${urls.verifier}/api/v1/verify/presentation`
      : `${urls.verifier}/api/v1/verify`
    const body = verificationPayload.kind === "presentation"
      ? { presentation: verificationPayload.data }
      : { credential: verificationPayload.data }

    // Proxy to verifier backend
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
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
