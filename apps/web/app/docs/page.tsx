"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  ArrowRight,
  Book,
  Code,
  FileCode,
  Layers,
  Shield,
  Wallet,
  Zap,
  CheckCircle,
  Terminal,
  GitBranch,
  ExternalLink,
  Sparkles,
} from "lucide-react"
import { useI18n } from "@/lib/i18n/provider"

export default function DocsPage() {
  const { t } = useI18n()

  const quickLinks = [
    {
      titleKey: "docs.home.cards.quickstart.title",
      descriptionKey: "docs.home.cards.quickstart.description",
      href: "/docs/quickstart/installation",
      icon: Zap,
      color: "text-amber-500",
    },
    {
      titleKey: "docs.home.cards.architecture.title",
      descriptionKey: "docs.home.cards.architecture.description",
      href: "/docs/architecture/overview",
      icon: Layers,
      color: "text-blue-500",
    },
    {
      titleKey: "docs.home.cards.smartContracts.title",
      descriptionKey: "docs.home.cards.smartContracts.description",
      href: "/docs/smart-contracts/facets",
      icon: FileCode,
      color: "text-purple-500",
    },
    {
      titleKey: "docs.home.cards.api.title",
      descriptionKey: "docs.home.cards.api.description",
      href: "/docs/api/issuer",
      icon: Code,
      color: "text-green-500",
    },
  ]

  const features = [
    {
      titleKey: "docs.architecture.diamond.title",
      descriptionKey: "docs.architecture.diamond.subtitle",
      icon: Sparkles,
    },
    {
      titleKey: "docs.security.eip712.title",
      descriptionKey: "docs.security.eip712.subtitle",
      icon: Shield,
    },
    {
      titleKey: "docs.home.cards.security.title",
      descriptionKey: "docs.home.cards.security.description",
      icon: Wallet,
    },
    {
      titleKey: "docs.home.cards.introduction.title",
      descriptionKey: "docs.home.cards.introduction.description",
      icon: CheckCircle,
    },
  ]

  return (
    <div className="space-y-12">
      {/* Hero */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1">
            <GitBranch className="h-3 w-3" />
            v1.0.0
          </Badge>
          <Badge variant="outline" className="gap-1 border-green-500/30 text-green-600 dark:text-green-400">
            <CheckCircle className="h-3 w-3" />
            Stable
          </Badge>
        </div>
        
        <h1 className="text-4xl font-bold tracking-tight">
          {t("docs.home.title")}
        </h1>
        
        <p className="text-xl text-muted-foreground leading-relaxed max-w-2xl">
          {t("docs.home.subtitle")}
        </p>

        <div className="flex flex-wrap gap-3 pt-2">
          <Button asChild>
            <Link href="/docs/quickstart/installation">
              {t("common.next")}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="https://github.com/AlastriaE/vc-vp-alastria" target="_blank">
              <GitBranch className="mr-2 h-4 w-4" />
              GitHub
              <ExternalLink className="ml-2 h-3 w-3" />
            </Link>
          </Button>
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid sm:grid-cols-2 gap-4">
        {quickLinks.map((link) => {
          const Icon = link.icon
          return (
            <Link key={link.href} href={link.href}>
              <Card className="h-full transition-all hover:shadow-md hover:border-primary/30 group">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-muted ${link.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <CardTitle className="text-lg group-hover:text-primary transition-colors">
                      {t(link.titleKey)}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm">
                    {t(link.descriptionKey)}
                  </CardDescription>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      {/* Features Overview */}
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold tracking-tight">
          {t("landing.features.title")}
        </h2>
        
        <div className="grid sm:grid-cols-2 gap-4">
          {features.map((feature) => {
            const Icon = feature.icon
            return (
              <div
                key={feature.titleKey}
                className="flex gap-4 p-4 rounded-lg border bg-card"
              >
                <div className="p-2 rounded-md bg-primary/10 text-primary h-fit">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-medium">{t(feature.titleKey)}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t(feature.descriptionKey)}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Quick Install */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">
          {t("docs.quickstart.installation.title")}
        </h2>
        
        <Card className="overflow-hidden">
          <div className="bg-muted/50 px-4 py-2 border-b flex items-center gap-2">
            <Terminal className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Terminal</span>
          </div>
          <CardContent className="p-0">
            <pre className="p-4 overflow-x-auto">
              <code className="text-sm">
                <span className="text-muted-foreground"># Clone repository</span>
                {"\n"}
                <span className="text-green-600 dark:text-green-400">git clone</span> https://github.com/AlastriaE/vc-vp-alastria.git
                {"\n"}
                <span className="text-green-600 dark:text-green-400">cd</span> vc-vp-alastria
                {"\n\n"}
                <span className="text-muted-foreground"># Install dependencies</span>
                {"\n"}
                <span className="text-green-600 dark:text-green-400">pnpm</span> install
                {"\n\n"}
                <span className="text-muted-foreground"># Start development environment</span>
                {"\n"}
                <span className="text-green-600 dark:text-green-400">pnpm</span> dev:docker:init:test
              </code>
            </pre>
          </CardContent>
        </Card>
      </div>

      {/* Architecture Preview */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">
          {t("docs.architecture.overview.title")}
        </h2>
        
        <Card className="p-6">
          <div className="grid grid-cols-3 gap-4 text-center">
            {/* Frontend */}
            <div className="space-y-2">
              <div className="h-20 rounded-lg bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/30 flex items-center justify-center">
                <span className="font-medium text-blue-600 dark:text-blue-400">Frontend</span>
              </div>
              <p className="text-xs text-muted-foreground">Next.js 15 + React 19</p>
            </div>

            {/* Backend */}
            <div className="space-y-2">
              <div className="h-20 rounded-lg bg-gradient-to-br from-green-500/20 to-green-600/10 border border-green-500/30 flex items-center justify-center flex-col gap-1">
                <span className="font-medium text-green-600 dark:text-green-400">Issuer</span>
                <span className="font-medium text-green-600 dark:text-green-400">Verifier</span>
              </div>
              <p className="text-xs text-muted-foreground">Fastify + TypeScript</p>
            </div>

            {/* Blockchain */}
            <div className="space-y-2">
              <div className="h-20 rounded-lg bg-gradient-to-br from-purple-500/20 to-purple-600/10 border border-purple-500/30 flex items-center justify-center">
                <span className="font-medium text-purple-600 dark:text-purple-400">Diamond</span>
              </div>
              <p className="text-xs text-muted-foreground">Solidity + EIP-2535</p>
            </div>
          </div>

          {/* Arrows */}
          <div className="flex justify-center gap-8 my-4">
            <ArrowRight className="h-5 w-5 text-muted-foreground rotate-90" />
            <ArrowRight className="h-5 w-5 text-muted-foreground rotate-90" />
            <ArrowRight className="h-5 w-5 text-muted-foreground rotate-90" />
          </div>

          {/* MetaMask Snap */}
          <div className="flex justify-center">
            <div className="space-y-2 text-center">
              <div className="h-16 w-48 rounded-lg bg-gradient-to-br from-orange-500/20 to-orange-600/10 border border-orange-500/30 flex items-center justify-center">
                <Wallet className="h-5 w-5 text-orange-500 mr-2" />
                <span className="font-medium text-orange-600 dark:text-orange-400">MetaMask Snap</span>
              </div>
              <p className="text-xs text-muted-foreground">{t("docs.architecture.overview.components.snap.description")}</p>
            </div>
          </div>
        </Card>

        <p className="text-sm text-muted-foreground">
          {t("docs.nav.architecture")} →{" "}
          <Link href="/docs/architecture/overview" className="text-primary hover:underline">
            {t("docs.nav.overview")}
          </Link>
        </p>
      </div>

      {/* Next Steps */}
      <div className="rounded-lg border bg-muted/30 p-6 space-y-4">
        <h2 className="text-xl font-semibold">{t("docs.nav.quickstart")}</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          <Link 
            href="/docs/introduction" 
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Book className="h-4 w-4" />
            <span>{t("docs.nav.introduction")}</span>
          </Link>
          <Link 
            href="/docs/quickstart/installation" 
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Terminal className="h-4 w-4" />
            <span>{t("docs.nav.installation")}</span>
          </Link>
          <Link 
            href="/docs/architecture/diamond" 
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Layers className="h-4 w-4" />
            <span>{t("docs.nav.diamondPattern")}</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
