import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, ArrowRight, Layers, Database, Globe, Box, Wallet, Server, Blocks, Users } from "lucide-react"

export default function ArchitectureOverviewPage() {
  return (
    <div className="space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/docs" className="hover:text-foreground">Docs</Link>
        <span>/</span>
        <Link href="/docs/architecture/overview" className="hover:text-foreground">Arquitectura</Link>
        <span>/</span>
        <span className="text-foreground">Visión General</span>
      </div>

      {/* Title */}
      <div className="space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">Visión General de la Arquitectura</h1>
        <p className="text-xl text-muted-foreground">
          El sistema Alastria VC/VP está compuesto por múltiples componentes que trabajan 
          juntos para proporcionar una infraestructura completa de credenciales verificables.
        </p>
      </div>

      {/* Stack Overview */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold" id="stack">Stack Tecnológico</h2>
        
        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-blue-500" />
                <CardTitle className="text-base">Frontend</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">Next.js 15</Badge>
                <Badge variant="secondary">React 19</Badge>
                <Badge variant="secondary">TypeScript</Badge>
                <Badge variant="secondary">Tailwind CSS</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Aplicación web moderna con SSR, rutas API, y componentes reutilizables.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Server className="h-5 w-5 text-green-500" />
                <CardTitle className="text-base">Backend Services</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">Fastify</Badge>
                <Badge variant="secondary">TypeScript</Badge>
                <Badge variant="secondary">SQLite</Badge>
                <Badge variant="secondary">Ethers.js</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Servicios de emisión y verificación de alta performance.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Blocks className="h-5 w-5 text-purple-500" />
                <CardTitle className="text-base">Smart Contracts</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">Solidity ^0.8.24</Badge>
                <Badge variant="secondary">Diamond (EIP-2535)</Badge>
                <Badge variant="secondary">Hardhat</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Contratos modulares para registro de emisores y estado de credenciales.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-orange-500" />
                <CardTitle className="text-base">MetaMask Snap</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">TypeScript</Badge>
                <Badge variant="secondary">Snaps SDK</Badge>
                <Badge variant="secondary">SES</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Extensión para almacenamiento seguro de VCs en el wallet del usuario.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Architecture Diagram */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold" id="diagrama">Diagrama de Arquitectura</h2>
        
        <Card className="p-8">
          <div className="space-y-8">
            {/* User Layer */}
            <div className="text-center">
              <Badge variant="outline" className="mb-4">Capa de Usuario</Badge>
              <div className="flex justify-center gap-8">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center mx-auto">
                    <Users className="h-8 w-8 text-blue-500" />
                  </div>
                  <p className="text-xs mt-2 text-muted-foreground">Holder</p>
                </div>
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center mx-auto">
                    <Users className="h-8 w-8 text-green-500" />
                  </div>
                  <p className="text-xs mt-2 text-muted-foreground">Issuer</p>
                </div>
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-purple-500/10 border border-purple-500/30 flex items-center justify-center mx-auto">
                    <Users className="h-8 w-8 text-purple-500" />
                  </div>
                  <p className="text-xs mt-2 text-muted-foreground">Verifier</p>
                </div>
              </div>
            </div>

            {/* Arrows */}
            <div className="flex justify-center">
              <div className="h-8 w-0.5 bg-gradient-to-b from-border to-border/50" />
            </div>

            {/* Frontend Layer */}
            <div className="text-center">
              <Badge variant="outline" className="mb-4">Capa de Presentación</Badge>
              <div className="max-w-md mx-auto">
                <div className="p-4 rounded-lg bg-gradient-to-r from-blue-500/10 to-purple-500/10 border">
                  <div className="flex items-center justify-center gap-4">
                    <Globe className="h-6 w-6 text-blue-500" />
                    <span className="font-medium">Frontend Next.js</span>
                    <Wallet className="h-6 w-6 text-orange-500" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">Web App + MetaMask Snap</p>
                </div>
              </div>
            </div>

            {/* Arrows */}
            <div className="flex justify-center gap-24">
              <div className="h-8 w-0.5 bg-gradient-to-b from-border to-border/50" />
              <div className="h-8 w-0.5 bg-gradient-to-b from-border to-border/50" />
            </div>

            {/* Backend Layer */}
            <div className="text-center">
              <Badge variant="outline" className="mb-4">Capa de Servicios</Badge>
              <div className="flex justify-center gap-4">
                <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30 w-40">
                  <Server className="h-6 w-6 text-green-500 mx-auto mb-2" />
                  <p className="font-medium text-sm">Issuer Service</p>
                  <p className="text-xs text-muted-foreground">:8001</p>
                </div>
                <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/30 w-40">
                  <Server className="h-6 w-6 text-purple-500 mx-auto mb-2" />
                  <p className="font-medium text-sm">Verifier Service</p>
                  <p className="text-xs text-muted-foreground">:8002</p>
                </div>
              </div>
            </div>

            {/* Arrows */}
            <div className="flex justify-center">
              <div className="h-8 w-0.5 bg-gradient-to-b from-border to-border/50" />
            </div>

            {/* Blockchain Layer */}
            <div className="text-center">
              <Badge variant="outline" className="mb-4">Capa Blockchain</Badge>
              <div className="max-w-sm mx-auto">
                <div className="p-4 rounded-lg bg-gradient-to-r from-purple-500/10 to-pink-500/10 border">
                  <Blocks className="h-6 w-6 text-purple-500 mx-auto mb-2" />
                  <p className="font-medium">Diamond Contract</p>
                  <div className="flex justify-center gap-2 mt-2">
                    <Badge variant="secondary" className="text-xs">TrustedIssuer</Badge>
                    <Badge variant="secondary" className="text-xs">CredentialStatus</Badge>
                    <Badge variant="secondary" className="text-xs">Proof</Badge>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </section>

      {/* Components */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold" id="componentes">Componentes Principales</h2>
        
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="p-2 rounded-lg bg-blue-500/10 flex-shrink-0">
                  <Globe className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Frontend (Next.js)</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Interfaz web para todas las operaciones: solicitar credenciales, 
                    ver wallet, crear presentaciones y verificar VCs. Incluye dashboard 
                    de administración para issuers.
                  </p>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="px-2 py-1 rounded bg-muted">Puerto: 3000</span>
                    <span className="px-2 py-1 rounded bg-muted">/issuer - Panel emisor</span>
                    <span className="px-2 py-1 rounded bg-muted">/verify - Verificación</span>
                    <span className="px-2 py-1 rounded bg-muted">/wallet - Mis VCs</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="p-2 rounded-lg bg-green-500/10 flex-shrink-0">
                  <Server className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Issuer Service</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Backend encargado de la emisión de credenciales. Gestiona el flujo 
                    de claim (solicitud), generación de VC, firma EIP-712, y entrega al holder.
                    Incluye sincronización con blockchain.
                  </p>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="px-2 py-1 rounded bg-muted">Puerto: 8001</span>
                    <span className="px-2 py-1 rounded bg-muted">/api/v1/auth/*</span>
                    <span className="px-2 py-1 rounded bg-muted">/api/v1/issue/*</span>
                    <span className="px-2 py-1 rounded bg-muted">/api/v1/credentials/*</span>
                    <span className="px-2 py-1 rounded bg-muted">/api/v1/system/*</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="p-2 rounded-lg bg-purple-500/10 flex-shrink-0">
                  <Server className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Verifier Service</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Backend que verifica presentaciones y credenciales. Valida firmas EIP-712, 
                    comprueba el estado on-chain, y verifica que el emisor esté autorizado.
                  </p>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="px-2 py-1 rounded bg-muted">Puerto: 8002</span>
                    <span className="px-2 py-1 rounded bg-muted">/api/v1/verify</span>
                    <span className="px-2 py-1 rounded bg-muted">/api/v1/presentations</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="p-2 rounded-lg bg-orange-500/10 flex-shrink-0">
                  <Wallet className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">MetaMask Snap</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Extensión que corre dentro de MetaMask Flask. Proporciona almacenamiento 
                    seguro para VCs, gestión de credenciales, y creación de presentaciones.
                  </p>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="px-2 py-1 rounded bg-muted">Puerto: 8080 (dev)</span>
                    <span className="px-2 py-1 rounded bg-muted">@circuloos/snap</span>
                    <span className="px-2 py-1 rounded bg-muted">Encrypted Storage</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Data Flow */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold" id="flujo-datos">Flujo de Datos</h2>
        
        <p className="text-muted-foreground">
          El sistema sigue un flujo claro para cada operación principal:
        </p>

        <div className="grid md:grid-cols-2 gap-4">
          <Card className="bg-green-500/5 border-green-500/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-green-600 dark:text-green-400">
                📤 Emisión de Credencial
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <p>1. Holder solicita credencial (claim)</p>
              <p>2. Issuer verifica identidad</p>
              <p>3. Issuer crea y firma VC (EIP-712)</p>
              <p>4. VC se entrega y almacena en Snap</p>
            </CardContent>
          </Card>

          <Card className="bg-purple-500/5 border-purple-500/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-purple-600 dark:text-purple-400">
                ✓ Verificación
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <p>1. Verifier solicita presentación</p>
              <p>2. Holder crea VP desde sus VCs</p>
              <p>3. Verifier valida firmas + on-chain</p>
              <p>4. Resultado: válido / inválido</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-8 border-t">
        <Link 
          href="/docs/introduction/use-cases" 
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Casos de Uso
        </Link>
        <Link 
          href="/docs/architecture/diamond" 
          className="flex items-center gap-2 text-primary hover:underline"
        >
          Diamond Pattern
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  )
}
