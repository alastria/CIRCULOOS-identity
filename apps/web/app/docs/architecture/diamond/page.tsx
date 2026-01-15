import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ArrowLeft, ArrowRight, Info, Sparkles, Box, Layers, Puzzle, Zap, Shield, Settings } from "lucide-react"

export default function DiamondPage() {
  return (
    <div className="space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/docs" className="hover:text-foreground">Docs</Link>
        <span>/</span>
        <Link href="/docs/architecture/overview" className="hover:text-foreground">Arquitectura</Link>
        <span>/</span>
        <span className="text-foreground">Diamond Pattern</span>
      </div>

      {/* Title */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Badge className="bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20">
            EIP-2535
          </Badge>
          <Badge variant="outline">Core Architecture</Badge>
        </div>
        <h1 className="text-4xl font-bold tracking-tight">Diamond Pattern</h1>
        <p className="text-xl text-muted-foreground">
          Arquitectura modular y upgradeable para smart contracts. El Diamond actúa como
          un proxy que delega llamadas a múltiples contratos de implementación llamados Facets.
        </p>
      </div>

      {/* What is Diamond */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold" id="que-es">¿Qué es el Diamond Pattern?</h2>

        <p className="text-muted-foreground">
          El <strong>Diamond Pattern</strong> (EIP-2535) es un estándar que permite crear
          smart contracts modulares, upgradeables y sin límite de tamaño. En lugar de tener
          un único contrato monolítico, la funcionalidad se divide en múltiples <em>facets</em>.
        </p>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            El Diamond supera el límite de 24KB de los contratos de Ethereum al dividir
            la lógica en múltiples contratos más pequeños.
          </AlertDescription>
        </Alert>
      </section>

      {/* Visual Diagram */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold" id="arquitectura">Arquitectura</h2>

        <Card className="p-6">
          <div className="space-y-6">
            {/* Diamond */}
            <div className="flex justify-center">
              <div className="w-64 p-4 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-600/10 border-2 border-purple-500/30 text-center">
                <Sparkles className="h-8 w-8 mx-auto text-purple-500 mb-2" />
                <h3 className="font-bold text-lg">Diamond Proxy</h3>
                <p className="text-xs text-muted-foreground mt-1">0xe7f1725E...0bb3F0512</p>
                <div className="mt-3 p-2 rounded bg-background/50 text-xs">
                  <code>delegatecall → Facet</code>
                </div>
              </div>
            </div>

            {/* Arrow */}
            <div className="flex justify-center">
              <div className="h-8 w-0.5 bg-border" />
            </div>

            {/* Facets */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Card className="bg-blue-500/5 border-blue-500/20">
                <CardContent className="p-4 text-center">
                  <Shield className="h-5 w-5 mx-auto text-blue-500 mb-2" />
                  <h4 className="font-medium text-sm">TrustedIssuerFacet</h4>
                  <p className="text-xs text-muted-foreground mt-1">Gestión de emisores</p>
                </CardContent>
              </Card>

              <Card className="bg-green-500/5 border-green-500/20">
                <CardContent className="p-4 text-center">
                  <Box className="h-5 w-5 mx-auto text-green-500 mb-2" />
                  <h4 className="font-medium text-sm">CredentialStatusFacet</h4>
                  <p className="text-xs text-muted-foreground mt-1">Estado de VCs</p>
                </CardContent>
              </Card>



              <Card className="bg-pink-500/5 border-pink-500/20">
                <CardContent className="p-4 text-center">
                  <Layers className="h-5 w-5 mx-auto text-pink-500 mb-2" />
                  <h4 className="font-medium text-sm">DiamondLoupeFacet</h4>
                  <p className="text-xs text-muted-foreground mt-1">Introspección</p>
                </CardContent>
              </Card>

              <Card className="bg-cyan-500/5 border-cyan-500/20">
                <CardContent className="p-4 text-center">
                  <Settings className="h-5 w-5 mx-auto text-cyan-500 mb-2" />
                  <h4 className="font-medium text-sm">OwnershipFacet</h4>
                  <p className="text-xs text-muted-foreground mt-1">Propietario</p>
                </CardContent>
              </Card>

              <Card className="bg-amber-500/5 border-amber-500/20">
                <CardContent className="p-4 text-center">
                  <Puzzle className="h-5 w-5 mx-auto text-amber-500 mb-2" />
                  <h4 className="font-medium text-sm">DiamondCutFacet</h4>
                  <p className="text-xs text-muted-foreground mt-1">Upgrades</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </Card>
      </section>

      {/* How it works */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold" id="funcionamiento">Cómo Funciona</h2>

        <div className="space-y-4">
          <div className="flex gap-4 p-4 rounded-lg border">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold text-sm">
              1
            </div>
            <div>
              <h4 className="font-medium">Llamada al Diamond</h4>
              <p className="text-sm text-muted-foreground">
                El usuario llama a una función en la dirección del Diamond (ej: <code className="text-xs bg-muted px-1 rounded">addTrustedIssuer()</code>)
              </p>
            </div>
          </div>

          <div className="flex gap-4 p-4 rounded-lg border">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold text-sm">
              2
            </div>
            <div>
              <h4 className="font-medium">Lookup del Selector</h4>
              <p className="text-sm text-muted-foreground">
                El Diamond busca el selector de función (primeros 4 bytes del calldata) en su
                mapping para encontrar qué Facet implementa esa función.
              </p>
            </div>
          </div>

          <div className="flex gap-4 p-4 rounded-lg border">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold text-sm">
              3
            </div>
            <div>
              <h4 className="font-medium">Delegatecall</h4>
              <p className="text-sm text-muted-foreground">
                El Diamond ejecuta <code className="text-xs bg-muted px-1 rounded">delegatecall</code> al
                Facet correspondiente. El código del Facet se ejecuta en el contexto del Diamond
                (mismo storage, msg.sender, etc).
              </p>
            </div>
          </div>

          <div className="flex gap-4 p-4 rounded-lg border">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold text-sm">
              4
            </div>
            <div>
              <h4 className="font-medium">Respuesta</h4>
              <p className="text-sm text-muted-foreground">
                El resultado se devuelve al llamador como si el Diamond hubiera ejecutado
                la lógica directamente.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Diamond Storage */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold" id="storage">Diamond Storage</h2>

        <p className="text-muted-foreground">
          Para evitar colisiones de storage entre Facets, cada uno usa un <strong>namespace único</strong>
          calculado a partir de un hash. Esto se conoce como <em>Diamond Storage Pattern</em>.
        </p>

        <Card className="overflow-hidden">
          <CardHeader className="bg-muted/50 py-3">
            <CardTitle className="text-sm font-mono">TrustedIssuerStorage.sol</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <pre className="p-4 text-sm overflow-x-auto">
              {`library TrustedIssuerStorage {
    // Unique storage slot
    bytes32 constant STORAGE_SLOT = 
        keccak256("alastria.storage.TrustedIssuer");
    
    struct Storage {
        mapping(address => bool) trustedIssuers;
        address[] issuerList;
    }
    
    function getStorage() internal pure returns (Storage storage s) {
        bytes32 slot = STORAGE_SLOT;
        assembly {
            s.slot := slot
        }
    }
}`}
            </pre>
          </CardContent>
        </Card>
      </section>

      {/* Benefits */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold" id="beneficios">Beneficios</h2>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-lg border bg-card">
            <h4 className="font-medium text-green-600 dark:text-green-400 mb-2">✓ Sin límite de tamaño</h4>
            <p className="text-sm text-muted-foreground">
              Añade tantos Facets como necesites sin preocuparte por el límite de 24KB.
            </p>
          </div>

          <div className="p-4 rounded-lg border bg-card">
            <h4 className="font-medium text-green-600 dark:text-green-400 mb-2">✓ Upgradeable</h4>
            <p className="text-sm text-muted-foreground">
              Actualiza, añade o elimina Facets sin perder el estado ni cambiar la dirección.
            </p>
          </div>

          <div className="p-4 rounded-lg border bg-card">
            <h4 className="font-medium text-green-600 dark:text-green-400 mb-2">✓ Modular</h4>
            <p className="text-sm text-muted-foreground">
              Cada Facet encapsula una funcionalidad específica, facilitando el desarrollo y testing.
            </p>
          </div>

          <div className="p-4 rounded-lg border bg-card">
            <h4 className="font-medium text-green-600 dark:text-green-400 mb-2">✓ Una sola dirección</h4>
            <p className="text-sm text-muted-foreground">
              Los usuarios interactúan con una única dirección de contrato para todas las funciones.
            </p>
          </div>
        </div>
      </section>

      {/* Our Facets */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold" id="nuestros-facets">Nuestros Facets</h2>

        <div className="space-y-3">
          <Link href="/docs/contracts/trusted-issuer" className="block p-4 rounded-lg border hover:border-primary/50 transition-colors">
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-blue-500" />
              <div>
                <h4 className="font-medium">TrustedIssuerFacet</h4>
                <p className="text-sm text-muted-foreground">
                  Gestiona el registro de emisores de confianza. Solo emisores autorizados pueden emitir VCs válidas.
                </p>
              </div>
            </div>
          </Link>

          <Link href="/docs/contracts/credential-status" className="block p-4 rounded-lg border hover:border-primary/50 transition-colors">
            <div className="flex items-center gap-3">
              <Box className="h-5 w-5 text-green-500" />
              <div>
                <h4 className="font-medium">CredentialStatusFacet</h4>
                <p className="text-sm text-muted-foreground">
                  Almacena el estado de las credenciales (activa, revocada, suspendida) de forma verificable on-chain.
                </p>
              </div>
            </div>
          </Link>


        </div>
      </section>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-8 border-t">
        <Link
          href="/docs/architecture/overview"
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Visión General
        </Link>
        <Link
          href="/docs/architecture/eip712"
          className="flex items-center gap-2 text-primary hover:underline"
        >
          EIP-712 Signatures
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  )
}
