import { type NextRequest, NextResponse } from "next/server"
import type { Application, ApplicationStatus } from "@/lib/types/application"

// In-memory store for demo (use database in production)
const applications: Application[] = []

// Whitelist domains for auto-approval - configurable via environment
const whitelistDomains = process.env.WHITELIST_DOMAINS?.split(',').map(d => d.trim()) || []
const whitelistEmails = process.env.WHITELIST_EMAILS?.split(',').map(e => e.trim()) || []

function isWhitelisted(email: string): boolean {
  const domain = email.split("@")[1]
  return whitelistDomains.includes(domain) || whitelistEmails.includes(email)
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const status = searchParams.get("status") as ApplicationStatus | null
  const search = searchParams.get("search")

  let filtered = [...applications]

  if (status && (status as string) !== "ALL") {
    filtered = filtered.filter((app) => app.status === status)
  }

  if (search) {
    const searchLower = search.toLowerCase()
    filtered = filtered.filter(
      (app) =>
        app.email.toLowerCase().includes(searchLower) ||
        app.fullName.toLowerCase().includes(searchLower) ||
        app.walletAddress.toLowerCase().includes(searchLower),
    )
  }

  return NextResponse.json({ applications: filtered })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, fullName, organization, walletAddress, reason } = body

    // Validate required fields
    if (!email || !fullName || !walletAddress) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 })
    }

    // Validate wallet address
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 })
    }

    // Check for existing pending application
    const existingPending = applications.find(
      (app) => (app.email === email || app.walletAddress === walletAddress) && app.status === "PENDING",
    )

    if (existingPending) {
      return NextResponse.json({ error: "You already have a pending application" }, { status: 409 })
    }

    // Determine if auto-approved
    const autoApproved = isWhitelisted(email)

    const application: Application = {
      id: `app_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      email,
      fullName,
      organization: organization || undefined,
      walletAddress,
      reason: reason || undefined,
      status: autoApproved ? "AUTO_APPROVED" : "PENDING",
      createdAt: new Date().toISOString(),
      reviewedAt: autoApproved ? new Date().toISOString() : undefined,
      ipAddress: request.headers.get("x-forwarded-for") || "unknown",
    }

    applications.push(application)

    // If auto-approved, create issuance (in real app)
    if (autoApproved) {
      // TODO: Create issuance and send magic link
      application.issuanceId = `iss_${Date.now().toString(36)}`
    }

    return NextResponse.json({
      success: true,
      application: {
        id: application.id,
        status: application.status,
        autoApproved,
      },
    })
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
