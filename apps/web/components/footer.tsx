"use client"

import Link from "next/link"
import Image from "next/image"
import { useI18n } from "@/lib/i18n/provider"
import { config } from "@/config"

export function Footer() {
  const { t } = useI18n()

  return (
    <footer className="border-t border-border/50 bg-background/50 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Logo and Copyright */}
          <div className="flex items-center gap-3">
            <div className="relative w-8 h-8">
              <Image
                src="/favicon_alastria.png"
                alt={t("images.alastria")}
                fill
                className="object-contain"
              />
            </div>
            <span className="text-sm text-muted-foreground">{t("footer.copyright")}</span>
          </div>

          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link
              href={`${config.issuerApiUrl}/api/v1/docs/`}
              className="hover:text-foreground transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              API Issuer
            </Link>
            <Link
              href={`${config.verifierApiUrl}/api/v1/docs/`}
              className="hover:text-foreground transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              API Verifier
            </Link>
            <Link href="/docs" className="hover:text-foreground transition-colors">
              {t("footer.links.docs")}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
