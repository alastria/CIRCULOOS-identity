import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, ArrowRight, Shield, Key, User, Wallet, CheckCircle, AlertTriangle } from "lucide-react"

export default function SIWAAuthPage() {
  return (
    <div className="space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/docs" className="hover:text-foreground">Docs</Link>
        <span>/</span>
        <Link href="/docs/security/siwa" className="hover:text-foreground">Security</Link>
        <span>/</span>
        <span className="text-foreground">SIWA Authentication</span>
      </div>

      {/* Title */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400">
            Authentication
          </Badge>
          <Badge variant="outline">EIP-4361</Badge>
        </div>
        <h1 className="text-4xl font-bold tracking-tight">Sign-In with Alastria (SIWA)</h1>
        <p className="text-xl text-muted-foreground">
          Sistema de autenticación descentralizada basado en EIP-4361 (SIWE). 
          Los usuarios se autentican firmando un mensaje con su wallet, sin necesidad 
          de contraseñas ni servidores de identidad centralizados.
        </p>
      </div>

      {/* How it Works */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold" id="how">¿Cómo funciona?</h2>
        
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="text-center">
            <CardHeader className="pb-2">
              <div className="mx-auto h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center mb-2">
                <span className="text-blue-600 dark:text-blue-400 font-bold text-xl">1</span>
              </div>
              <CardTitle className="text-sm">Solicitar Challenge</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                El frontend solicita un nonce único al backend
              </p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardHeader className="pb-2">
              <div className="mx-auto h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center mb-2">
                <span className="text-green-600 dark:text-green-400 font-bold text-xl">2</span>
              </div>
              <CardTitle className="text-sm">Firmar Mensaje</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                El usuario firma el mensaje SIWA con MetaMask
              </p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardHeader className="pb-2">
              <div className="mx-auto h-12 w-12 rounded-full bg-purple-500/10 flex items-center justify-center mb-2">
                <span className="text-purple-600 dark:text-purple-400 font-bold text-xl">3</span>
              </div>
              <CardTitle className="text-sm">Verificar Firma</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                El backend verifica la firma y recupera la dirección
              </p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardHeader className="pb-2">
              <div className="mx-auto h-12 w-12 rounded-full bg-orange-500/10 flex items-center justify-center mb-2">
                <span className="text-orange-600 dark:text-orange-400 font-bold text-xl">4</span>
              </div>
              <CardTitle className="text-sm">Crear Sesión</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Se establece una sesión JWT con cookie segura
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* SIWA Message Format */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold" id="message">Formato del Mensaje SIWA</h2>
        
        <p className="text-muted-foreground">
          El mensaje SIWA sigue el formato estándar EIP-4361, estructurado para ser 
          legible por humanos y parseable por máquinas.
        </p>

        <Card className="overflow-hidden">
          <CardHeader className="bg-muted/30">
            <CardTitle className="text-lg font-mono">Ejemplo de Mensaje</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <pre className="p-4 text-sm overflow-x-auto">
{`alastria.io wants you to sign in with your Ethereum account:
0x1234567890abcdef1234567890abcdef12345678

Sign in to Alastria Credentials Platform

URI: https://alastria.io
Version: 1
Chain ID: 2020
Nonce: abc123xyz789
Issued At: 2024-01-15T10:30:00.000Z
Expiration Time: 2024-01-15T11:30:00.000Z
Resources:
- https://alastria.io/api/v1/credentials
- https://alastria.io/api/v1/presentations`}
            </pre>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="bg-blue-500/5 border-blue-500/20">
            <CardContent className="pt-4">
              <h4 className="font-semibold mb-2">📋 Campos del Mensaje</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li><strong>domain:</strong> Origen que solicita la firma</li>
                <li><strong>address:</strong> Dirección del usuario</li>
                <li><strong>statement:</strong> Descripción legible</li>
                <li><strong>uri:</strong> URI del recurso</li>
                <li><strong>version:</strong> Versión del protocolo</li>
                <li><strong>chainId:</strong> ID de la red blockchain</li>
                <li><strong>nonce:</strong> Valor único anti-replay</li>
                <li><strong>issuedAt:</strong> Timestamp de emisión</li>
                <li><strong>expirationTime:</strong> Expiración del challenge</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="bg-yellow-500/5 border-yellow-500/20">
            <CardContent className="pt-4">
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                Seguridad del Nonce
              </h4>
              <p className="text-sm text-muted-foreground">
                El nonce es crítico para la seguridad:
              </p>
              <ul className="text-sm text-muted-foreground mt-2 space-y-1 list-disc list-inside">
                <li>Generado criptográficamente seguro</li>
                <li>Almacenado en servidor con TTL corto</li>
                <li>Invalidado tras primer uso</li>
                <li>Vinculado a la dirección solicitante</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Implementation */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold" id="implementation">Implementación</h2>

        {/* Frontend */}
        <Card className="overflow-hidden">
          <CardHeader className="bg-muted/30">
            <CardTitle className="text-lg">Frontend (React)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <pre className="p-4 text-sm overflow-x-auto">
{`import { SiweMessage } from 'siwe';
import { useAccount, useSignMessage } from 'wagmi';

export function useSIWA() {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const signIn = async () => {
    // 1. Obtener challenge del backend
    const challengeRes = await fetch(
      \`/api/v1/auth/challenge/\${address}\`
    );
    const { nonce, issuedAt, expiresAt } = await challengeRes.json();

    // 2. Construir mensaje SIWA
    const message = new SiweMessage({
      domain: window.location.host,
      address: address,
      statement: 'Sign in to Alastria Credentials Platform',
      uri: window.location.origin,
      version: '1',
      chainId: 2020, // Alastria T-Network
      nonce: nonce,
      issuedAt: issuedAt,
      expirationTime: expiresAt,
    });

    // 3. Firmar con MetaMask
    const signature = await signMessageAsync({
      message: message.prepareMessage(),
    });

    // 4. Enviar al backend para verificar
    const verifyRes = await fetch('/api/v1/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Importante para cookies
      body: JSON.stringify({
        address,
        signature,
        nonce,
      }),
    });

    if (verifyRes.ok) {
      const { isTrustedIssuer } = await verifyRes.json();
      return { success: true, isTrustedIssuer };
    }

    throw new Error('Authentication failed');
  };

  return { signIn };
}`}
            </pre>
          </CardContent>
        </Card>

        {/* Backend */}
        <Card className="overflow-hidden">
          <CardHeader className="bg-muted/30">
            <CardTitle className="text-lg">Backend (Fastify)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <pre className="p-4 text-sm overflow-x-auto">
{`import { SiweMessage } from 'siwe';
import { FastifyInstance } from 'fastify';
import crypto from 'crypto';

// Store para nonces (en producción usar Redis)
const nonceStore = new Map<string, { address: string; expires: Date }>();

export async function siwaRoutes(fastify: FastifyInstance) {
  // GET /auth/challenge - Generar nonce
  fastify.get('/auth/challenge', async (request, reply) => {
    const { address } = request.query as { address: string };
    
    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return reply.status(400).send({ error: 'Invalid address' });
    }

    const nonce = crypto.randomBytes(16).toString('hex');
    const issuedAt = new Date();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min

    // Guardar nonce
    nonceStore.set(nonce, { address, expires: expiresAt });

    return {
      nonce,
      message: buildSiwaMessage(address, nonce, issuedAt, expiresAt),
      issuedAt: issuedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };
  });

  // POST /auth/verify - Verificar firma
  fastify.post('/auth/verify', async (request, reply) => {
    const { message, signature, nonce } = request.body as {
      message: string;
      signature: string;
      nonce: string;
    };

    // Verificar que el nonce existe y no ha expirado
    const nonceData = nonceStore.get(nonce);
    if (!nonceData || nonceData.expires < new Date()) {
      return reply.status(401).send({ error: 'Invalid or expired nonce' });
    }

    // Invalidar nonce (single use)
    nonceStore.delete(nonce);

    try {
      // Parsear y verificar mensaje SIWA
      const siweMessage = new SiweMessage(message);
      const { data: verified } = await siweMessage.verify({ signature });

      // Verificar que la dirección coincide
      if (verified.address.toLowerCase() !== nonceData.address.toLowerCase()) {
        return reply.status(401).send({ error: 'Address mismatch' });
      }

      // Verificar si es Trusted Issuer (on-chain)
      const isTrustedIssuer = await checkTrustedIssuer(verified.address);

      // Crear sesión JWT
      const token = fastify.jwt.sign({
        address: verified.address,
        isTrustedIssuer,
        iat: Math.floor(Date.now() / 1000),
      }, { expiresIn: '24h' });

      // Establecer cookie segura
      reply.setCookie('alastria_session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: 24 * 60 * 60, // 24 hours
      });

      return {
        success: true,
        address: verified.address,
        isTrustedIssuer,
      };
    } catch (error) {
      return reply.status(401).send({ error: 'Invalid signature' });
    }
  });
}`}
            </pre>
          </CardContent>
        </Card>
      </section>

      {/* Session Management */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold" id="sessions">Gestión de Sesiones</h2>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Key className="h-4 w-4 text-blue-500" />
                JWT Token
              </CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-sm overflow-x-auto bg-muted/30 p-3 rounded">
{`{
  "address": "0x1234...",
  "isTrustedIssuer": true,
  "iat": 1705312200,
  "exp": 1705398600
}`}
              </pre>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4 text-green-500" />
                Cookie Segura
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li><code>HttpOnly:</code> No accesible desde JS</li>
                <li><code>Secure:</code> Solo HTTPS en producción</li>
                <li><code>SameSite=Strict:</code> Anti-CSRF</li>
                <li><code>Path=/:</code> Disponible en toda la app</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Protected Routes */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold" id="protected">Rutas Protegidas</h2>

        <Card className="overflow-hidden">
          <CardHeader className="bg-muted/30">
            <CardTitle className="text-lg">Middleware de Autenticación</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <pre className="p-4 text-sm overflow-x-auto">
{`// auth.middleware.ts
import { FastifyRequest, FastifyReply } from 'fastify';

export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const token = request.cookies.alastria_session;
    
    if (!token) {
      return reply.status(401).send({ error: 'Not authenticated' });
    }

    const decoded = request.server.jwt.verify(token);
    request.user = decoded;
  } catch (error) {
    return reply.status(401).send({ error: 'Invalid session' });
  }
}

export async function requireTrustedIssuer(
  request: FastifyRequest,
  reply: FastifyReply
) {
  await requireAuth(request, reply);
  
  if (!request.user?.isTrustedIssuer) {
    return reply.status(403).send({ 
      error: 'Not authorized. Must be a Trusted Issuer.' 
    });
  }
}

// Uso en rutas
fastify.post('/credentials/issue', {
  preHandler: [requireTrustedIssuer],
}, async (request, reply) => {
  // Solo Trusted Issuers pueden llegar aquí
  const issuerAddress = request.user.address;
  // ...
});`}
            </pre>
          </CardContent>
        </Card>
      </section>

      {/* Security Best Practices */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold" id="security">Mejores Prácticas</h2>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="bg-green-500/5 border-green-500/30">
            <CardContent className="pt-4">
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Recomendaciones
              </h4>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>✓ Nonces de un solo uso con TTL corto</li>
                <li>✓ Verificar domain y chainId del mensaje</li>
                <li>✓ Usar cookies HttpOnly + Secure</li>
                <li>✓ Implementar rate limiting</li>
                <li>✓ Rotar secrets de JWT regularmente</li>
                <li>✓ Logging de intentos de autenticación</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="bg-red-500/5 border-red-500/30">
            <CardContent className="pt-4">
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                Evitar
              </h4>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>✗ Almacenar tokens en localStorage</li>
                <li>✗ Reutilizar nonces</li>
                <li>✗ Expiraciones muy largas</li>
                <li>✗ Confiar solo en client-side validation</li>
                <li>✗ Exponer errores detallados al cliente</li>
                <li>✗ Ignorar expiración de mensajes SIWA</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Error Handling */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold" id="errors">Manejo de Errores</h2>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-4 font-medium">Error</th>
                <th className="text-left py-2 px-4 font-medium">Causa</th>
                <th className="text-left py-2 px-4 font-medium">Solución</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="py-2 px-4"><code>Invalid nonce</code></td>
                <td className="py-2 px-4 text-muted-foreground">Nonce expirado o usado</td>
                <td className="py-2 px-4 text-muted-foreground">Solicitar nuevo challenge</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 px-4"><code>Address mismatch</code></td>
                <td className="py-2 px-4 text-muted-foreground">Firma con wallet diferente</td>
                <td className="py-2 px-4 text-muted-foreground">Verificar wallet conectado</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 px-4"><code>Invalid signature</code></td>
                <td className="py-2 px-4 text-muted-foreground">Mensaje modificado o firma incorrecta</td>
                <td className="py-2 px-4 text-muted-foreground">Reiniciar flujo de autenticación</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 px-4"><code>Session expired</code></td>
                <td className="py-2 px-4 text-muted-foreground">JWT expirado</td>
                <td className="py-2 px-4 text-muted-foreground">Re-autenticar</td>
              </tr>
              <tr>
                <td className="py-2 px-4"><code>Not a Trusted Issuer</code></td>
                <td className="py-2 px-4 text-muted-foreground">Dirección no registrada</td>
                <td className="py-2 px-4 text-muted-foreground">Contactar admin para registro</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-8 border-t">
        <Link 
          href="/docs/security/eip712" 
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          EIP-712 Security
        </Link>
        <Link 
          href="/docs" 
          className="flex items-center gap-2 text-primary hover:underline"
        >
          Volver a Docs
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  )
}
