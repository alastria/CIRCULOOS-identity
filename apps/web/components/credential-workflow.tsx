"use client"

import type React from "react"

import { useI18n } from "@/lib/i18n/provider"
import { motion } from "framer-motion"
import { Mail, PenTool, FileCheck, Zap, HardDrive, ShieldCheck } from "lucide-react"

export function CredentialWorkflow() {
  const { t } = useI18n()

  const nodeVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.15, duration: 0.5, ease: "easeOut" },
    }),
  }

  const StepCard = ({
    step,
    icon: Icon,
    title,
    description,
    variant = "default",
    badge,
  }: {
    step: string
    icon: React.ElementType
    title: string
    description: string
    variant?: "default" | "orange" | "blue" | "green"
    badge?: string
  }) => {
    const colors = {
      default: {
        border: "border-border",
        bg: "bg-card",
        iconBg: "bg-gradient-to-br from-primary to-primary/70",
        iconShadow: "shadow-primary/20",
        stepColor: "text-primary/70",
        titleColor: "text-foreground",
      },
      orange: {
        border: "border-[#F6851B]/40",
        bg: "bg-[#F6851B]/5",
        iconBg: "bg-gradient-to-br from-[#F6851B] to-[#E2761B]",
        iconShadow: "shadow-[#F6851B]/20",
        stepColor: "text-[#F6851B]",
        titleColor: "text-foreground",
      },
      blue: {
        border: "border-blue-500/40",
        bg: "bg-blue-500/5",
        iconBg: "bg-gradient-to-br from-blue-500 to-blue-600",
        iconShadow: "shadow-blue-500/20",
        stepColor: "text-blue-500",
        titleColor: "text-foreground",
      },
      green: {
        border: "border-green-500/40",
        bg: "bg-green-500/5",
        iconBg: "bg-gradient-to-br from-green-500 to-green-600",
        iconShadow: "shadow-green-500/20",
        stepColor: "text-green-500",
        titleColor: "text-green-600 dark:text-green-400",
      },
    }

    const c = colors[variant]

    return (
      <div className={`rounded-2xl p-5 border ${c.border} ${c.bg} backdrop-blur-sm relative`}>
        {badge && (
          <div className="absolute top-3 right-3">
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-green-500/20 text-green-600 dark:text-green-400 rounded-full border border-green-500/30">
              {badge}
            </span>
          </div>
        )}
        <div className="flex items-start gap-4">
          <div
            className={`flex-shrink-0 w-12 h-12 rounded-xl ${c.iconBg} flex items-center justify-center shadow-lg ${c.iconShadow}`}
          >
            <Icon className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <span className={`text-[10px] font-bold ${c.stepColor} uppercase tracking-widest`}>{step}</span>
            <h3 className={`text-base font-semibold mt-0.5 ${c.titleColor}`}>{title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed mt-1">{description}</p>
          </div>
        </div>
      </div>
    )
  }

  const Connector = ({ color = "primary" }: { color?: "primary" | "orange" | "blue" | "green" }) => {
    const colorMap = {
      primary: "bg-primary/40",
      orange: "bg-[#F6851B]/40",
      blue: "bg-blue-500/40",
      green: "bg-green-500/40",
    }
    return <div className={`w-0.5 h-10 ${colorMap[color]} mx-auto`} />
  }

  return (
    <div className="relative w-full max-w-4xl mx-auto py-8 px-4">
      <div className="flex flex-col items-center">
        {/* Step 1 */}
        <motion.div
          className="w-full max-w-md"
          variants={nodeVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          custom={0}
        >
          <StepCard
            step="Step 1"
            icon={Mail}
            title={t("workflow.step1.title")}
            description={t("workflow.step1.description")}
          />
        </motion.div>

        <Connector />

        {/* Step 2 */}
        <motion.div
          className="w-full max-w-md"
          variants={nodeVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          custom={1}
        >
          <StepCard
            step="Step 2"
            icon={PenTool}
            title={t("workflow.step2.title")}
            description={t("workflow.step2.description")}
          />
        </motion.div>

        <Connector />

        {/* Step 3 */}
        <motion.div
          className="w-full max-w-md"
          variants={nodeVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          custom={2}
        >
          <StepCard
            step="Step 3"
            icon={FileCheck}
            title={t("workflow.step3.title")}
            description={t("workflow.step3.description")}
          />
        </motion.div>

        <div className="flex items-center justify-center gap-3 my-4">
          <div className="h-0.5 w-16 bg-gradient-to-r from-transparent to-[#F6851B]/60" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Choose Path</span>
          <div className="h-0.5 w-16 bg-gradient-to-l from-transparent to-blue-500/60" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl">
          {/* Route A - MetaMask */}
          <motion.div
            variants={nodeVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            custom={3}
          >
            <StepCard
              step="Route A"
              icon={Zap}
              title={t("workflow.routeA.title")}
              description={t("workflow.routeA.description")}
              variant="orange"
              badge={t("workflow.recommended")}
            />
          </motion.div>

          {/* Route B - Self Custody */}
          <motion.div
            variants={nodeVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            custom={3}
          >
            <StepCard
              step="Route B"
              icon={HardDrive}
              title={t("workflow.routeB.title")}
              description={t("workflow.routeB.description")}
              variant="blue"
            />
          </motion.div>
        </div>

        <div className="flex items-center justify-center gap-3 my-4">
          <div className="h-0.5 w-16 bg-gradient-to-r from-[#F6851B]/60 to-green-500/60" />
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <div className="h-0.5 w-16 bg-gradient-to-l from-blue-500/60 to-green-500/60" />
        </div>

        {/* Step 4 */}
        <motion.div
          className="w-full max-w-md"
          variants={nodeVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          custom={4}
        >
          <StepCard
            step="Step 4"
            icon={ShieldCheck}
            title={t("workflow.step4.title")}
            description={t("workflow.step4.description")}
            variant="green"
          />
        </motion.div>
      </div>
    </div>
  )
}
