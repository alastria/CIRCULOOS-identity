"use client"

import type React from "react"

import { useRef, useState } from "react"
import { motion } from "framer-motion"
import { ShieldCheck, Fingerprint, Globe2, Wallet, type LucideIcon } from "lucide-react"
import { useI18n } from "@/lib/i18n/provider"

interface SpotlightCardProps {
  icon: LucideIcon
  title: string
  description: string
  index: number
}

function SpotlightCard({ icon: Icon, title, description, index }: SpotlightCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const [isHovered, setIsHovered] = useState(false)

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    setMousePosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    })
  }

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="group relative overflow-hidden rounded-xl border border-border bg-card/80 backdrop-blur-sm p-6"
    >
      {/* Spotlight gradient overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: isHovered
            ? `radial-gradient(600px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(22, 20, 89, 0.15), transparent 40%)`
            : "none",
        }}
      />

      {/* Border spotlight effect */}
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: isHovered
            ? `radial-gradient(400px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(242, 63, 21, 0.1), transparent 40%)`
            : "none",
        }}
      />

      {/* Icon container */}
      <div className="relative mb-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg border-t border-border bg-gradient-to-b from-secondary to-muted">
          <Icon className="h-6 w-6 text-foreground" />
        </div>
      </div>

      {/* Content - Use semantic colors */}
      <h3 className="mb-2 text-lg font-semibold text-foreground">{title}</h3>
      <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
    </motion.div>
  )
}

export function AlastriaFeatures() {
  const { t } = useI18n()

  const features = [
    {
      icon: ShieldCheck,
      titleKey: "landing.features.security.title",
      descKey: "landing.features.security.description",
    },
    {
      icon: Fingerprint,
      titleKey: "landing.features.privacy.title",
      descKey: "landing.features.privacy.description",
    },
    {
      icon: Globe2,
      titleKey: "landing.features.interop.title",
      descKey: "landing.features.interop.description",
    },
    {
      icon: Wallet,
      titleKey: "landing.features.custody.title",
      descKey: "landing.features.custody.description",
    },
  ]

  return (
    <section className="relative w-full py-24 overflow-hidden bg-secondary/50">
      {/* Subtle grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.03] dark:opacity-[0.02]"
        style={{
          backgroundImage: `linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
        }}
      />

      <div className="container relative z-10 mx-auto px-4">
        {/* Section header - Use semantic colors */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-12 text-center"
        >
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {t("landing.features.title")}
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">{t("landing.features.subtitle")}</p>
        </motion.div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 max-w-4xl mx-auto">
          {features.map((feature, index) => (
            <SpotlightCard
              key={feature.titleKey}
              icon={feature.icon}
              title={t(feature.titleKey)}
              description={t(feature.descKey)}
              index={index}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
