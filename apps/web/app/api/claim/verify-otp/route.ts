import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, otp } = body

    if (!token || !otp) {
      return NextResponse.json({ error: "Token and OTP are required" }, { status: 400 })
    }

    if (otp.length !== 6) {
      return NextResponse.json({ error: "Invalid OTP format" }, { status: 400 })
    }

    // In production, verify OTP against stored hash
    // For demo, accept any 6-digit code

    return NextResponse.json({
      valid: true,
      message: "OTP verified successfully",
    })
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
