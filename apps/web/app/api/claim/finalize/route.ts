import { type NextRequest, NextResponse } from "next/server"
import { urls } from "@/config"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, otp, signature, signer } = body

    if (!token || !otp || !signature || !signer) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Proxy to issuer backend
    const response = await fetch(`${urls.issuer}/issue/finalize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: token,  // token is the issuance ID
        otp,
        signature,
        signer
      })
    })

    const result = await response.json()

    if (!response.ok) {
      return NextResponse.json({
        error: result.error || "Failed to finalize claim"
      }, { status: response.status })
    }

    const vcId = result.vcId || result.vc?.id || result.id
    let credential = result.vc || result

    if (vcId) {
      const publicCredentialResponse = await fetch(`${urls.issuer}/credentials/${encodeURIComponent(vcId)}/public`)
      if (publicCredentialResponse.ok) {
        credential = await publicCredentialResponse.json()
      }
    }

    return NextResponse.json({
      success: true,
      credential,
      message: "Credential claimed successfully",
    })
  } catch (error: any) {
    // console.error('Finalize error:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
