import { type NextRequest, NextResponse } from "next/server"
import { urls } from "@/config"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token } = body

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 })
    }

    // Proxy to issuer backend
    const response = await fetch(`${urls.issuer}/issue/info/${encodeURIComponent(token)}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    })

    const result = await response.json()

    if (!response.ok) {
      return NextResponse.json({
        valid: false,
        reason: "INVALID_TOKEN",
        message: result.error || "Invalid or expired token"
      }, { status: response.status })
    }

    // Transform backend response to frontend format
    return NextResponse.json({
      valid: result.valid,
      issuance: {
        id: result.id,
        holderEmail: result.holderAddress, // TODO: Get real email if stored
        holderAddress: result.holderAddress,
        credentialType: result.credentialType || 'VerifiableCredential',
        attributes: {}, // Will be filled when claiming
        issuedAt: new Date().toISOString(),
        expiresAt: new Date(result.expiresAt).toISOString(),
      },
      otpExpiresAt: new Date(result.expiresAt).toISOString(),
    })
  } catch (error: any) {
    // console.error('Token validation error:', error)
    return NextResponse.json({
      valid: false,
      reason: "ERROR",
      message: "Internal server error"
    }, { status: 500 })
  }
}
