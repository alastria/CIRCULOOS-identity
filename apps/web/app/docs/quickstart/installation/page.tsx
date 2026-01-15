import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ArrowLeft, ArrowRight, Terminal, CheckCircle, AlertTriangle, Info, Copy } from "lucide-react"

export default function InstallationPage() {
  return (
    <div className="space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/docs" className="hover:text-foreground">Docs</Link>
        <span>/</span>
        <Link href="/docs/quickstart/installation" className="hover:text-foreground">Guía Rápida</Link>
        <span>/</span>
        <span className="text-foreground">Instalación</span>
      </div>

      {/* Title */}
      <div className="space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">Instalación</h1>
        <p className="text-xl text-muted-foreground">
          Configura el entorno de desarrollo local en pocos minutos.
        </p>
      </div>

      {/* Prerequisites */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold" id="requisitos">Requisitos Previos</h2>
        
        <div className="grid sm:grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <h3 className="font-medium">Node.js 20+</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Recomendamos usar <a href="https://github.com/nvm-sh/nvm" className="text-primary hover:underline">nvm</a> para gestionar versiones.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <h3 className="font-medium">pnpm 10+</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Gestor de paquetes rápido y eficiente.{" "}
                <code className="text-xs bg-muted px-1 rounded">npm i -g pnpm</code>
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <h3 className="font-medium">Docker & Docker Compose</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Para ejecutar el entorno containerizado completo.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <h3 className="font-medium">MetaMask Flask</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Versión de desarrollo con soporte para Snaps.{" "}
                <a href="https://metamask.io/flask/" className="text-primary hover:underline">Descargar</a>
              </p>
            </CardContent>
          </Card>
        </div>

        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            MetaMask Flask es necesario para probar el Snap en desarrollo. 
            No instales Flask si ya tienes MetaMask regular - usa un navegador 
            diferente o un perfil separado.
          </AlertDescription>
        </Alert>
      </section>

      {/* Clone */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold" id="clonar">1. Clonar el Repositorio</h2>
        
        <Card className="overflow-hidden">
          <CardHeader className="bg-muted/50 py-3 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm font-mono">Terminal</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <pre className="p-4 text-sm overflow-x-auto">
              <code>
                <span className="text-green-600 dark:text-green-400">git clone</span> https://github.com/AlastriaE/vc-vp-alastria.git{"\n"}
                <span className="text-green-600 dark:text-green-400">cd</span> vc-vp-alastria
              </code>
            </pre>
          </CardContent>
        </Card>
      </section>

      {/* Install deps */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold" id="dependencias">2. Instalar Dependencias</h2>
        
        <p className="text-muted-foreground">
          El proyecto usa pnpm workspaces para gestionar múltiples paquetes.
        </p>

        <Card className="overflow-hidden">
          <CardHeader className="bg-muted/50 py-3">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm font-mono">Terminal</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <pre className="p-4 text-sm overflow-x-auto">
              <code>
                <span className="text-muted-foreground"># Instalar todas las dependencias</span>{"\n"}
                <span className="text-green-600 dark:text-green-400">pnpm</span> install
              </code>
            </pre>
          </CardContent>
        </Card>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            La instalación puede tardar unos minutos la primera vez. pnpm descargará 
            las dependencias para frontend, backends, smart contracts y snap.
          </AlertDescription>
        </Alert>
      </section>

      {/* Start Docker */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold" id="docker">3. Iniciar con Docker</h2>
        
        <p className="text-muted-foreground">
          El comando más fácil para empezar es usar Docker. Esto levanta todos 
          los servicios automáticamente: blockchain (Hardhat), backend services, 
          frontend, y snap.
        </p>

        <Card className="overflow-hidden">
          <CardHeader className="bg-muted/50 py-3">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm font-mono">Terminal</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <pre className="p-4 text-sm overflow-x-auto">
              <code>
                <span className="text-muted-foreground"># Iniciar entorno completo con testing de emails</span>{"\n"}
                <span className="text-green-600 dark:text-green-400">pnpm</span> dev:docker:init:test
              </code>
            </pre>
          </CardContent>
        </Card>

        <div className="p-4 rounded-lg bg-muted/50 border">
          <h4 className="font-medium mb-3">Este comando:</h4>
          <ol className="text-sm text-muted-foreground space-y-2">
            <li className="flex items-start gap-2">
              <span className="bg-primary text-primary-foreground w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0">1</span>
              <span>Construye las imágenes Docker para todos los servicios</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="bg-primary text-primary-foreground w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0">2</span>
              <span>Levanta un nodo Hardhat local (blockchain de desarrollo)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="bg-primary text-primary-foreground w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0">3</span>
              <span>Despliega el Diamond contract con todos los facets</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="bg-primary text-primary-foreground w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0">4</span>
              <span>Añade la wallet de desarrollo como Trusted Issuer</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="bg-primary text-primary-foreground w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0">5</span>
              <span>Inicia Issuer, Verifier, Frontend y Mailpit</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="bg-primary text-primary-foreground w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0">6</span>
              <span>Inicia el servidor del Snap en localhost:8080</span>
            </li>
          </ol>
        </div>
      </section>

      {/* Services */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold" id="servicios">4. Servicios Disponibles</h2>
        
        <p className="text-muted-foreground">
          Una vez iniciado, tendrás acceso a:
        </p>

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="font-medium">Frontend</span>
            </div>
            <code className="text-sm text-muted-foreground">localhost:3000</code>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="font-medium">Issuer API</span>
            </div>
            <code className="text-sm text-muted-foreground">localhost:8001</code>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="font-medium">Verifier API</span>
            </div>
            <code className="text-sm text-muted-foreground">localhost:8002</code>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="font-medium">Hardhat RPC</span>
            </div>
            <code className="text-sm text-muted-foreground">localhost:8545</code>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-orange-500" />
              <span className="font-medium">MetaMask Snap</span>
            </div>
            <code className="text-sm text-muted-foreground">localhost:8080</code>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span className="font-medium">Mailpit (emails)</span>
            </div>
            <code className="text-sm text-muted-foreground">localhost:8025</code>
          </div>
        </div>
      </section>

      {/* Configure MetaMask */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold" id="metamask">5. Configurar MetaMask</h2>
        
        <div className="space-y-4">
          <div className="p-4 rounded-lg border bg-card">
            <h4 className="font-medium mb-2">Añadir red de desarrollo</h4>
            <p className="text-sm text-muted-foreground mb-3">
              Añade la red de Hardhat local a MetaMask Flask:
            </p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="p-2 rounded bg-muted">
                <span className="text-muted-foreground">Network Name:</span>
                <br />Hardhat Local
              </div>
              <div className="p-2 rounded bg-muted">
                <span className="text-muted-foreground">RPC URL:</span>
                <br />http://localhost:8545
              </div>
              <div className="p-2 rounded bg-muted">
                <span className="text-muted-foreground">Chain ID:</span>
                <br />31337
              </div>
              <div className="p-2 rounded bg-muted">
                <span className="text-muted-foreground">Currency:</span>
                <br />ETH
              </div>
            </div>
          </div>

          <div className="p-4 rounded-lg border bg-card">
            <h4 className="font-medium mb-2">Importar cuenta de desarrollo</h4>
            <p className="text-sm text-muted-foreground mb-3">
              Usa esta private key de Hardhat (cuenta 0) que tiene ETH y es Trusted Issuer:
            </p>
            <Card className="overflow-hidden">
              <CardContent className="p-3 font-mono text-xs break-all bg-muted">
                0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
              </CardContent>
            </Card>
            <p className="text-xs text-muted-foreground mt-2">
              ⚠️ Esta clave es pública y solo para desarrollo local.
            </p>
          </div>
        </div>
      </section>

      {/* Verify */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold" id="verificar">6. Verificar Instalación</h2>
        
        <p className="text-muted-foreground">
          Comprueba que todo funciona correctamente:
        </p>

        <ol className="space-y-3 text-sm">
          <li className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs flex-shrink-0">1</span>
            <div>
              <p className="font-medium">Abre el frontend</p>
              <p className="text-muted-foreground">
                Ve a <a href="http://localhost:3000" className="text-primary hover:underline">localhost:3000</a> y 
                verifica que carga correctamente.
              </p>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs flex-shrink-0">2</span>
            <div>
              <p className="font-medium">Instala el Snap</p>
              <p className="text-muted-foreground">
                Haz clic en "Instalar MetaMask Snap" en la landing page.
              </p>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs flex-shrink-0">3</span>
            <div>
              <p className="font-medium">Accede al panel de Issuer</p>
              <p className="text-muted-foreground">
                Ve a <a href="http://localhost:3000/issuer" className="text-primary hover:underline">localhost:3000/issuer</a> y 
                conecta con la cuenta de Hardhat.
              </p>
            </div>
          </li>
        </ol>
      </section>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-8 border-t">
        <Link 
          href="/docs" 
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Inicio
        </Link>
        <Link 
          href="/docs/quickstart/configuration" 
          className="flex items-center gap-2 text-primary hover:underline"
        >
          Configuración
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  )
}
