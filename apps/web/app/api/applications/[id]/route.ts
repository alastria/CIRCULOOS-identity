import { type NextRequest, NextResponse } from "next/server"

// Mock data store (shared with main route in production)
const applications: Map<string, unknown> = new Map()

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const app = applications.get(id)

  if (!app) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 })
  }

  return NextResponse.json({ application: app })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()
  const { action, rejectionReason } = body

  const app = applications.get(id) as Record<string, unknown> | undefined

  if (!app) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 })
  }

  if (action === "approve") {
    // Create issuance and send magic link
    const issuanceId = `iss_${Date.now().toString(36)}`

    applications.set(id, {
      ...app,
      status: "APPROVED",
      reviewedAt: new Date().toISOString(),
      issuanceId,
    })

    return NextResponse.json({
      success: true,
      issuanceId,
      message: "Application approved. Magic link sent to user.",
    })
  }

  if (action === "reject") {
    if (!rejectionReason) {
      return NextResponse.json({ error: "Rejection reason is required" }, { status: 400 })
    }

    applications.set(id, {
      ...app,
      status: "REJECTED",
      reviewedAt: new Date().toISOString(),
      rejectionReason,
    })

    return NextResponse.json({
      success: true,
      message: "Application rejected. User notified via email.",
    })
  }

  if (action === "reopen") {
    applications.set(id, {
      ...app,
      status: "PENDING",
      reviewedAt: undefined,
      rejectionReason: undefined,
    })

    return NextResponse.json({
      success: true,
      message: "Application reopened.",
    })
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 })
}
