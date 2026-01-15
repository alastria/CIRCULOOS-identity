"use client"

import { useI18n } from "@/lib/i18n/provider"
import { FileText, PenTool, ShieldCheck, Download, HardDrive, GitBranch } from "lucide-react"

export function WorkflowDiagram() {
  const { t } = useI18n()

  return (
    <div className="relative w-full max-w-4xl mx-auto">
      {/* Step 1 - Request */}
      <div className="flex flex-col items-center">
        <div className="flex items-center gap-4 w-full max-w-md">
          <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold">
            1
          </div>
          <div className="flex-1 glass glow-border rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h4 className="font-semibold">{t("landing.howItWorks.step1.title")}</h4>
                <p className="text-sm text-muted-foreground">{t("landing.howItWorks.step1.description")}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Connector down */}
        <div className="w-0.5 h-8 bg-gradient-to-b from-primary to-primary/50" />
      </div>

      {/* Step 2 - Sign & Claim */}
      <div className="flex flex-col items-center">
        <div className="flex items-center gap-4 w-full max-w-md">
          <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold">
            2
          </div>
          <div className="flex-1 glass glow-border rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <PenTool className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h4 className="font-semibold">{t("landing.howItWorks.step2.title")}</h4>
                <p className="text-sm text-muted-foreground">{t("landing.howItWorks.step2.description")}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Connector down */}
        <div className="w-0.5 h-6 bg-gradient-to-b from-primary to-primary/50" />

        {/* Download VC as PDF node */}
        <div className="flex items-center gap-4 w-full max-w-md">
          <div className="flex-shrink-0 w-12 h-12" />
          <div className="flex-1 glass rounded-xl p-3 border border-primary/30">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                <Download className="w-4 h-4 text-accent" />
              </div>
              <div>
                <p className="text-sm font-medium">{t("landing.howItWorks.downloadVC")}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Connector down to fork */}
        <div className="w-0.5 h-6 bg-gradient-to-b from-primary/50 to-accent" />

        {/* Fork indicator */}
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-accent/20 border-2 border-accent">
          <GitBranch className="w-5 h-5 text-accent" />
        </div>

        {/* Branch connectors */}
        <div className="relative w-full max-w-2xl h-8">
          {/* Left branch line */}
          <div className="absolute left-1/4 top-0 w-0.5 h-full bg-gradient-to-b from-accent to-[#F6851B]" />
          {/* Right branch line */}
          <div className="absolute right-1/4 top-0 w-0.5 h-full bg-gradient-to-b from-accent to-primary" />
          {/* Horizontal connector */}
          <div className="absolute top-0 left-1/4 right-1/4 h-0.5 bg-accent" />
        </div>
      </div>

      {/* Step 3 - Two Branches */}
      <div className="grid grid-cols-2 gap-6 w-full max-w-2xl mx-auto">
        {/* Left Branch - MetaMask Snap */}
        <div className="flex flex-col items-center">
          {/* 3.1 Header */}
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-[#F6851B] text-white flex items-center justify-center text-sm font-bold">
              3.1
            </div>
            <span className="text-xs font-medium text-[#F6851B] uppercase tracking-wide">MetaMask Snap</span>
          </div>

          {/* Snap Card */}
          <div className="w-full glass rounded-xl p-4 border border-[#F6851B]/30 space-y-3">
            <div className="flex items-center gap-2">
              <svg viewBox="0 0 35 33" className="w-6 h-6" fill="none">
                <path d="M32.9582 1L19.8241 10.7183L22.2665 4.99099L32.9582 1Z" fill="#E17726" />
                <path d="M2.04858 1L15.0707 10.809L12.7401 4.99098L2.04858 1Z" fill="#E27625" />
                <path
                  d="M28.2292 23.5334L24.7346 28.872L32.2175 30.932L34.3611 23.6526L28.2292 23.5334Z"
                  fill="#E27625"
                />
                <path
                  d="M0.658936 23.6526L2.78934 30.932L10.2722 28.872L6.77764 23.5334L0.658936 23.6526Z"
                  fill="#E27625"
                />
                <path
                  d="M9.87686 14.5149L7.81836 17.6507L15.2095 17.9883L14.9555 9.97803L9.87686 14.5149Z"
                  fill="#E27625"
                />
                <path
                  d="M25.1299 14.5149L19.9794 9.88721L19.8242 17.9883L27.1884 17.6507L25.1299 14.5149Z"
                  fill="#E27625"
                />
                <path d="M10.2722 28.872L14.7564 26.6963L10.8878 23.7014L10.2722 28.872Z" fill="#E27625" />
                <path d="M20.2502 26.6963L24.7344 28.872L24.1188 23.7014L20.2502 26.6963Z" fill="#E27625" />
              </svg>
              <span className="font-medium text-sm">{t("landing.howItWorks.snapRoute.title")}</span>
            </div>

            <div className="space-y-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#F6851B]" />
                <span>{t("landing.howItWorks.snapRoute.step1")}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#F6851B]" />
                <span>{t("landing.howItWorks.snapRoute.step2")}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#F6851B]" />
                <span>{t("landing.howItWorks.snapRoute.step3")}</span>
              </div>
            </div>
          </div>

          {/* Connector down */}
          <div className="w-0.5 h-6 bg-gradient-to-b from-[#F6851B] to-green-500" />
        </div>

        {/* Right Branch - Self-Custody PDF */}
        <div className="flex flex-col items-center">
          {/* 3.2 Header */}
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
              3.2
            </div>
            <span className="text-xs font-medium text-primary uppercase tracking-wide">
              {t("landing.howItWorks.pdfRoute.label")}
            </span>
          </div>

          {/* PDF Card */}
          <div className="w-full glass rounded-xl p-4 border border-primary/30 space-y-3">
            <div className="flex items-center gap-2">
              <HardDrive className="w-6 h-6 text-primary" />
              <span className="font-medium text-sm">{t("landing.howItWorks.pdfRoute.title")}</span>
            </div>

            <div className="space-y-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                <span>{t("landing.howItWorks.pdfRoute.step1")}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                <span>{t("landing.howItWorks.pdfRoute.step2")}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                <span>{t("landing.howItWorks.pdfRoute.step3")}</span>
              </div>
            </div>
          </div>

          {/* Connector down */}
          <div className="w-0.5 h-6 bg-gradient-to-b from-primary to-green-500" />
        </div>
      </div>

      {/* Merge connectors */}
      <div className="relative w-full max-w-2xl mx-auto h-8">
        {/* Left branch line up */}
        <div className="absolute left-1/4 bottom-0 w-0.5 h-full bg-green-500" />
        {/* Right branch line up */}
        <div className="absolute right-1/4 bottom-0 w-0.5 h-full bg-green-500" />
        {/* Horizontal connector */}
        <div className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-green-500" />
      </div>

      {/* Step 4 - Verify */}
      <div className="flex flex-col items-center">
        {/* Merge point */}
        <div className="w-0.5 h-4 bg-green-500" />

        <div className="flex items-center gap-4 w-full max-w-md">
          <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-green-500 text-white flex items-center justify-center text-xl font-bold">
            4
          </div>
          <div className="flex-1 glass glow-border rounded-xl p-4 border-green-500/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <h4 className="font-semibold text-green-600 dark:text-green-400">
                  {t("landing.howItWorks.step4.title")}
                </h4>
                <p className="text-sm text-muted-foreground">{t("landing.howItWorks.step4.description")}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
