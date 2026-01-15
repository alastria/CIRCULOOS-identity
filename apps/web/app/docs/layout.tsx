"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Book,
  Code,
  FileCode,
  Layers,
  Shield,
  Wallet,
  ChevronRight,
  Menu,
  Search,
  Home,
  Zap,
  Database,
  Globe,
  Key,
  CheckCircle,
  Settings,
  Terminal,
  BookOpen,
  GitBranch,
  Box,
  Users,
  ArrowRight,
} from "lucide-react"
import { useI18n } from "@/lib/i18n/provider"

interface NavItem {
  titleKey: string
  href?: string
  icon?: React.ComponentType<{ className?: string }>
  items?: NavItem[]
  badge?: string
}

function useNavigation(): NavItem[] {
  return [
    {
      titleKey: "docs.home.title",
      href: "/docs",
      icon: Home,
    },
    {
      titleKey: "docs.nav.introduction",
      icon: Book,
      items: [
        { titleKey: "docs.nav.whatIs", href: "/docs/introduction" },
        { titleKey: "docs.nav.coreConcepts", href: "/docs/introduction/concepts" },
      ],
    },
    {
      titleKey: "docs.nav.quickstart",
      icon: Zap,
      items: [
        { titleKey: "docs.nav.installation", href: "/docs/quickstart/installation" },
        { titleKey: "docs.nav.firstCredential", href: "/docs/quickstart/first-credential" },
      ],
    },
    {
      titleKey: "docs.nav.architecture",
      icon: Layers,
      items: [
        { titleKey: "docs.nav.overview", href: "/docs/architecture/overview" },
        { titleKey: "docs.nav.diamondPattern", href: "/docs/architecture/diamond", badge: "Core" },
      ],
    },
    {
      titleKey: "docs.nav.smartContracts",
      icon: FileCode,
      items: [
        { titleKey: "docs.nav.facets", href: "/docs/smart-contracts/facets" },
      ],
    },
    {
      titleKey: "docs.nav.api",
      icon: Code,
      items: [
        { titleKey: "docs.nav.issuerApi", href: "/docs/api/issuer" },
        { titleKey: "docs.nav.verifierApi", href: "/docs/api/verifier" },
      ],
    },
    {
      titleKey: "docs.nav.security",
      icon: Shield,
      items: [
        { titleKey: "docs.nav.eip712", href: "/docs/security/eip712" },
        { titleKey: "docs.nav.siwa", href: "/docs/security/siwa", badge: "New" },
      ],
    },
  ]
}

function NavItems({ items, level = 0 }: { items: NavItem[]; level?: number }) {
  const pathname = usePathname()
  const { t } = useI18n()

  return (
    <ul className={cn("space-y-1", level > 0 && "ml-4 border-l border-border pl-4")}>
      {items.map((item) => {
        const title = t(item.titleKey)
        const isActive = item.href === pathname
        const hasChildren = item.items && item.items.length > 0
        const isChildActive = item.items?.some((child) => child.href === pathname)
        const Icon = item.icon

        if (hasChildren) {
          return (
            <li key={item.titleKey}>
              <Collapsible defaultOpen={isChildActive}>
                <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors group">
                  {Icon && <Icon className="h-4 w-4" />}
                  <span className="flex-1 text-left">{title}</span>
                  <ChevronRight className="h-4 w-4 transition-transform group-data-[state=open]:rotate-90" />
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-1">
                  <NavItems items={item.items!} level={level + 1} />
                </CollapsibleContent>
              </Collapsible>
            </li>
          )
        }

        return (
          <li key={item.titleKey}>
            <Link
              href={item.href || "#"}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              {Icon && <Icon className="h-4 w-4" />}
              <span className="flex-1">{title}</span>
              {item.badge && (
                <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-primary/10 text-primary">
                  {item.badge}
                </span>
              )}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

function DocsSidebar({ className }: { className?: string }) {
  const [searchQuery, setSearchQuery] = useState("")
  const { t } = useI18n()
  const navigation = useNavigation()

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Search */}
      <div className="p-4 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("docs.search")}
            className="pl-9 bg-muted/50"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 p-4">
        <NavItems items={navigation} />
      </ScrollArea>

      {/* Footer */}
      <div className="p-4 border-t">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <GitBranch className="h-3 w-3" />
          <span>v1.0.0</span>
          <span className="text-border">•</span>
          <a href="https://github.com/AlastriaE/vc-vp-alastria" className="hover:text-foreground transition-colors">
            GitHub
          </a>
        </div>
      </div>
    </div>
  )
}

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-72 flex-col border-r bg-card/50 sticky top-16 h-[calc(100vh-4rem)]">
        <DocsSidebar />
      </aside>

      {/* Mobile Sidebar */}
      <Sheet>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden fixed bottom-4 right-4 z-50 h-12 w-12 rounded-full shadow-lg bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0">
          <DocsSidebar />
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <main className="flex-1 min-w-0">
        <div className="max-w-4xl mx-auto px-6 py-10">
          {children}
        </div>
      </main>

      {/* Table of Contents (Desktop) */}
      <aside className="hidden xl:block w-56 sticky top-16 h-[calc(100vh-4rem)] p-6">
        <div className="text-sm">
          <h4 className="font-semibold mb-3 text-foreground">En esta página</h4>
          <div className="space-y-2 text-muted-foreground" id="toc">
            {/* ToC will be populated by the page */}
          </div>
        </div>
      </aside>
    </div>
  )
}
