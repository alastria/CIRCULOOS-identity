import { z } from "zod"

/**
 * PRODUCTION-READY Environment Schema
 * NO hardcoded defaults - all URLs must be explicitly set
 * 
 * Required environment variables:
 * - NEXT_PUBLIC_API_URL: Backend API URL
 * - NEXT_PUBLIC_APP_URL: Frontend application URL
 * - NEXT_PUBLIC_ALASTRIA_RPC_URL: Blockchain RPC URL
 */
const envSchema = z.object({
  // API Backend - REQUIRED
  NEXT_PUBLIC_API_URL: z
    .string()
    .url("NEXT_PUBLIC_API_URL must be a valid URL"),

  // WalletConnect / Reown - Optional for local development
  NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: z.string().optional(),

  // Blockchain - Chain ID required
  NEXT_PUBLIC_DEFAULT_CHAIN_ID: z
    .string()
    .transform((val) => Number.parseInt(val, 10)),

  // RPC URL - REQUIRED
  NEXT_PUBLIC_ALASTRIA_RPC_URL: z
    .string()
    .url("NEXT_PUBLIC_ALASTRIA_RPC_URL must be a valid URL"),

  // App Config - REQUIRED
  NEXT_PUBLIC_APP_URL: z
    .string()
    .url("NEXT_PUBLIC_APP_URL must be a valid URL"),

  NEXT_PUBLIC_ENV: z.enum(["development", "staging", "production"]).default("development"),
})

export type Env = z.infer<typeof envSchema>

function validateEnv(): Env {
  const parsed = envSchema.safeParse({
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
    NEXT_PUBLIC_DEFAULT_CHAIN_ID: process.env.NEXT_PUBLIC_DEFAULT_CHAIN_ID,
    NEXT_PUBLIC_ALASTRIA_RPC_URL: process.env.NEXT_PUBLIC_ALASTRIA_RPC_URL,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_ENV: process.env.NEXT_PUBLIC_ENV,
  })

  if (!parsed.success) {
    console.error("❌ Invalid environment variables:", parsed.error.flatten().fieldErrors)
    throw new Error("Invalid environment variables. Check the console.")
  }

  return parsed.data
}

export const env = validateEnv()
