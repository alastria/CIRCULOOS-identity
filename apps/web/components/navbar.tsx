"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { useTheme } from "next-themes"
import { Shield, FileCheck, Menu, X, Moon, Sun, Globe, ChevronDown, Wallet, LogOut, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { useI18n } from "@/lib/i18n/provider"
import { useAccount, useConnect, useDisconnect } from "wagmi"
import { injected } from "wagmi/connectors"
import { cn } from "@/lib/utils"

const navLinks = [
  { href: "/wallet", label: "nav.myCredentials", icon: Wallet },
  { href: "/verify", label: "nav.verifyCredential", icon: FileCheck },
  { href: "/verify-presentation", label: "nav.verifyPresentation", icon: Shield },
]

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme, resolvedTheme } = useTheme()
  const { locale, setLocale, t } = useI18n()
  const { address, isConnected } = useAccount()
  const { connect, isPending } = useConnect()
  const { disconnect } = useDisconnect()

  useEffect(() => {
    setMounted(true)
  }, [])

  const toggleTheme = () => {
    const currentTheme = resolvedTheme || theme || "dark"
    const newTheme = currentTheme === "dark" ? "light" : "dark"
    setTheme(newTheme)
  }

  const truncateAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`

  const isDark = mounted && (resolvedTheme === "dark" || theme === "dark")

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative w-10 h-10 transition-transform group-hover:scale-105">
              <Image
                src="/favicon_alastria.png"
                alt="Alastria"
                fill
                className="object-contain"
              />
            </div>
            <span className="hidden sm:block font-semibold text-foreground">{t("common.appName")}</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-secondary/50"
              >
                <link.icon className="w-4 h-4" />
                {t(link.label)}
              </Link>
            ))}
          </div>

          {/* Right side controls */}
          <div className="flex items-center gap-2">
            {/* Language Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <Globe className="w-4 h-4" />
                  <span className="hidden sm:inline uppercase">{locale}</span>
                  <ChevronDown className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={() => setLocale("es")} className={cn(locale === "es" && "bg-secondary")}>
                  <span className="mr-2">ES</span>
                  Español
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLocale("en")} className={cn(locale === "en" && "bg-secondary")}>
                  <span className="mr-2">EN</span>
                  English
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="relative"
              aria-label={isDark ? t("aria.switchToLight") : t("aria.switchToDark")}
            >
              {mounted ? (
                isDark ? (
                  <Sun className="h-4 w-4 text-yellow-500 transition-all" />
                ) : (
                  <Moon className="h-4 w-4 text-slate-700 transition-all" />
                )
              ) : (
                <div className="h-4 w-4" />
              )}
            </Button>

            {/* Wallet Connection */}
            {isConnected && address ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2 bg-transparent">
                    <Wallet className="w-4 h-4" />
                    <span className="font-mono text-xs">{truncateAddress(address)}</span>
                    <ChevronDown className="w-3 h-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem className="font-mono text-xs break-all">{address}</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => disconnect()} className="text-destructive">
                    <LogOut className="w-4 h-4 mr-2" />
                    {t("wallet.disconnect")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                size="sm"
                onClick={() => connect({ connector: injected() })}
                disabled={isPending}
                className="gap-2"
              >
                <Wallet className="w-4 h-4" />
                <span className="hidden sm:inline">{isPending ? t("common.loading") : t("wallet.connect")}</span>
              </Button>
            )}

            {/* Mobile menu button */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden pb-4 animate-in slide-in-from-top-2 duration-200">
            <div className="flex flex-col gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-secondary/50"
                >
                  <link.icon className="w-5 h-5" />
                  {t(link.label)}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
