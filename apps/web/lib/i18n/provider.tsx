"use client"

import type React from "react"
import { createContext, useContext, useState, useCallback, useEffect } from "react"
import en from "./en.json"
import es from "./es.json"

type Locale = "en" | "es"
type Translations = typeof en

const translations: Record<Locale, Translations> = { en, es }

interface I18nContextType {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string, params?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nContextType | null>(null)

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("es")

  useEffect(() => {
    const saved = localStorage.getItem("alastria-locale") as Locale | null
    if (saved && (saved === "en" || saved === "es")) {
      setLocaleState(saved)
    }
  }, [])

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale)
    localStorage.setItem("alastria-locale", newLocale)
  }, [])

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      const keys = key.split(".")
      let value: unknown = translations[locale]

      for (const k of keys) {
        if (value && typeof value === "object" && k in value) {
          value = (value as Record<string, unknown>)[k]
        } else {
          // Return key if translation not found (never return object)
          return key
        }
      }

      // Ensure we always return a string, never an object
      let result: string
      if (typeof value === "string") {
        result = value
      } else if (value === null || value === undefined) {
        result = key
      } else {
        // If value is an object or other type, return the key instead
        result = key
      }
      
      // Simple interpolation: replace {key} with params[key]
      if (params) {
        Object.entries(params).forEach(([paramKey, paramValue]) => {
          result = result.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramValue))
        })
      }
      
      return result
    },
    [locale],
  )

  return <I18nContext.Provider value={{ locale, setLocale, t }}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider")
  }
  return context
}
