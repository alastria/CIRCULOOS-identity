"use client"

import { Circle, CheckCircle, Clock, FileSignature, Send, Link, Package, XCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useI18n } from "@/lib/i18n/provider"
import { cn } from "@/lib/utils"
import type { VCTimelineEvent } from "@/lib/types/vc"

interface VCTimelineProps {
  events: VCTimelineEvent[]
}

const eventConfig: Record<VCTimelineEvent["type"], { icon: typeof Circle; color: string; bg: string }> = {
  created: { icon: Circle, color: "text-blue-500", bg: "bg-blue-500" },
  "signed-issuer": { icon: FileSignature, color: "text-primary", bg: "bg-primary" },
  sent: { icon: Send, color: "text-purple-500", bg: "bg-purple-500" },
  "signed-holder": { icon: FileSignature, color: "text-green-500", bg: "bg-green-500" },
  registered: { icon: Link, color: "text-cyan-500", bg: "bg-cyan-500" },
  batched: { icon: Package, color: "text-orange-500", bg: "bg-orange-500" },
  revoked: { icon: XCircle, color: "text-red-500", bg: "bg-red-500" },
  expired: { icon: Clock, color: "text-red-500", bg: "bg-red-500" },
  current: { icon: CheckCircle, color: "text-green-500", bg: "bg-green-500" },
}

export function VCTimeline({ events }: VCTimelineProps) {
  const { locale, t } = useI18n()

  const getEventDescription = (event: VCTimelineEvent) => {
    const translationMap: Partial<Record<VCTimelineEvent["type"], string>> = {
      created: "vc.timeline.events.created",
      "signed-issuer": "vc.timeline.events.signedIssuer",
      "signed-holder": "vc.timeline.events.signedHolder",
      current: "vc.timeline.events.current",
      expired: "vc.timeline.events.expired",
      sent: "vc.timeline.events.sent",
      registered: "vc.timeline.events.registered",
      batched: "vc.timeline.events.batched",
      revoked: "vc.timeline.events.revoked",
    }

    const key = translationMap[event.type]
    return key ? t(key) : event.description
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return t("vc.timeline.unknownDate")
    const date = new Date(dateStr)
    return date.toLocaleDateString(locale === "es" ? "es-ES" : "en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Clock className="h-5 w-5 text-primary" />
          {t("vc.timeline.title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-[15px] top-0 bottom-0 w-0.5 bg-border" />

          {/* Events */}
          <div className="space-y-6">
            {events.map((event, index) => {
              const config = eventConfig[event.type]
              const Icon = config.icon

              return (
                <div key={event.id} className="relative flex gap-4">
                  {/* Icon */}
                  <div
                    className={cn(
                      "relative z-10 h-8 w-8 rounded-full flex items-center justify-center shrink-0",
                      config.bg,
                    )}
                  >
                    <Icon className="h-4 w-4 text-white" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 pb-2">
                    <p className="font-medium text-foreground">{getEventDescription(event)}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">{formatDate(event.date)}</p>
                    {event.actor && (
                      <p className="text-xs text-muted-foreground mt-1 font-mono truncate">{event.actor}</p>
                    )}
                    {event.transactionHash && (
                      <a
                        href={`https://etherscan.io/tx/${event.transactionHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline mt-1 inline-block"
                      >
                        {t("vc.timeline.viewTransaction")}
                      </a>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
