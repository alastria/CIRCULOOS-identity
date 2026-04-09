# Guión de Presentación en Vídeo — CIRCULOOS Identity Platform

> **Audiencia objetivo**: Técnicos, arquitectos, y stakeholders del ecosistema blockchain/SSI.  
> **Duración total estimada**: ~12–14 minutos (20 escenas).  
> **Formato de producción**: Grabar escena a escena, montar en post.  
> **Herramientas**: PowerPoint/Canva para slides · Chrome + MetaMask para browser · OBS para captura.

---

## Índice de Escenas

| # | Escena | Tipo | Duración |
|---|---|---|---|
| 1 | Portada | Slide | ~15s |
| 2 | El problema de la identidad digital | Slide | ~45s |
| 3 | El triángulo de confianza SSI | Slide | ~40s |
| 4 | Arquitectura de servicios | Slide | ~45s |
| 5 | Estructura del monorepo | VS Code | ~30s |
| 6 | EIP-712: firmas legibles | Slide | ~35s |
| 7 | Diamond Pattern: contratos modulares | Slide | ~35s |
| 8 | Entorno levantado — Docker | Terminal | ~25s |
| 9 | Login del Emisor con SIWA | Browser | ~50s |
| 10 | Preparar la credencial | Browser | ~40s |
| 11 | Firma EIP-712 en MetaMask | Browser + MetaMask | ~35s |
| 12 | Email al Holder — Mailpit | Browser | ~20s |
| 13 | Holder reclama la credencial | Browser + MetaMask | ~50s |
| 14 | Descarga del VC (JSON y PDF) | Browser | ~25s |
| 15 | Verificación pública de la credencial | Browser | ~50s |
| 16 | Revocación y re-verificación | Swagger UI + Browser | ~40s |
| 17 | MetaMask Snap — wallet de VCs | Slide | ~30s |
| 18 | PDF self-contained con metadatos XMP | PDF viewer | ~30s |
| 19 | Despliegue en red real Alastria | Slide | ~30s |
| 20 | Cierre | Slide | ~15s |

---

## BLOQUE 1 — Introducción Conceptual

---

### ESCENA 1 — Portada
**Tipo**: Slide  
**Duración**: ~15s

**Pantalla**:
- Título: *"CIRCULOOS Identity Platform"*
- Subtítulo: *"Credenciales Verificables sobre Alastria Blockchain"*
- Logotipos: Circuloos · Alastria · W3C

**Narración**:
> "CIRCULOOS Identity es una plataforma completa para emitir, gestionar y verificar credenciales digitales sobre la red blockchain de Alastria."

---

### ESCENA 2 — El problema de la identidad digital
**Tipo**: Slide (2 columnas: ❌ centralizado vs ✅ descentralizado)  
**Duración**: ~45s

**Pantalla**:
- Columna izquierda — *Hoy*: cada app tiene su silo, credenciales no portables, dependencia del proveedor, datos replicados en muchos servidores
- Columna derecha — *SSI*: el usuario es dueño de sus credenciales, portables entre sistemas, verificables sin contactar al emisor, estándares abiertos W3C

**Narración**:
> "Hoy, tus credenciales digitales viven en silos: LinkedIn, el portal de tu universidad, el sistema de RR.HH. de tu empresa. Son sistemas incompatibles y tú no controlas nada. La identidad auto-soberana invierte eso: las credenciales son tuyas, viajan contigo y cualquiera puede verificarlas sin necesitar al emisor original."

---

### ESCENA 3 — El triángulo de confianza SSI
**Tipo**: Slide con diagrama (triángulo animado o estático)  
**Duración**: ~40s

**Pantalla**:
- Triángulo con tres vértices:
  - **Issuer** (Emisor) — en este caso Circuloos / entidad autorizada
  - **Holder** (Usuario/Portador) — tiene la credencial en su wallet
  - **Verifier** (Verificador) — empresa, portal, sistema que valida
- Flechas:
  - Issuer → Holder: *"Emite VC firmada"*
  - Holder → Verifier: *"Presenta VP"*
  - Issuer ↔ Blockchain: *"Registra estado"*
  - Verifier ↔ Blockchain: *"Consulta estado"*

**Narración**:
> "El modelo tiene tres actores. El emisor crea y firma la credencial. El holder la guarda en su wallet. El verificador la valida — sin preguntarle al emisor, consultando directamente la blockchain."

---

## BLOQUE 2 — Arquitectura y Tecnologías

---

### ESCENA 4 — Arquitectura de servicios
**Tipo**: Slide con diagrama de bloques  
**Duración**: ~45s

**Pantalla**:
- Diagrama con 6 bloques conectados:

```
[Browser / DApp :3000]
        |
   +---------+--------+
   |                  |
[Issuer API :8001]  [Verifier API :8002]
   |                  |
   +--------+---------+
            |
   [Hardhat Node :8545]
   [Smart Contracts — Diamond]
            |
   [Mailpit :8025]  (solo dev)
```

- Tabla resumen debajo:

| Servicio | Stack | Puerto |
|---|---|---|
| Frontend DApp | Next.js · RainbowKit · Wagmi | 3000 |
| Issuer API | Node.js · Fastify | 8001 |
| Verifier API | Node.js · Fastify | 8002 |
| Blockchain | Hardhat / Alastria | 8545 |
| Email (dev) | Mailpit | 8025 |

**Narración**:
> "La plataforma tiene 5 servicios orquestados con Docker Compose. El frontend habla con el Issuer y el Verifier. Ambos backends consultan la blockchain. En desarrollo usamos Hardhat local y Mailpit para emails."

---

### ESCENA 5 — Estructura del monorepo
**Tipo**: VS Code — explorador de archivos  
**Duración**: ~30s

**Pantalla**:
- Abrir VS Code con la raíz del repositorio visible en el explorador
- Mostrar brevemente la estructura de carpetas: `apps/`, `libs/`, `tools/`
- Hacer zoom sobre:
  - `apps/contracts/` · `apps/issuer/` · `apps/verifier/` · `apps/web/` · `apps/snap/`
  - `libs/common/` (código compartido EIP-712)

**Narración**:
> "Es un monorepo gestionado con pnpm workspaces y Turborepo. Cada servicio vive en su carpeta bajo `apps/`. El código compartido — especialmente los schemas EIP-712 — está centralizado en `libs/common` para que frontend, backend y contratos usen exactamente los mismos tipos."

---

### ESCENA 6 — EIP-712: firmas legibles
**Tipo**: Slide (comparación lado a lado)  
**Duración**: ~35s

**Pantalla**:
- Título: *"EIP-712 — El usuario sabe lo que firma"*
- Izquierda — ❌ *Firma opaca tradicional*:
  ```
  0x4f2a7c3b9e1d8a6f04c2b5e7a9d3f1e8
  2b4a6c0f8e2d4b6a8c0e2f4b6a8c0e2f
  ```
- Derecha — ✅ *Firma EIP-712 (lo que ve el usuario en MetaMask)*:
  ```
  Acción:          Emitir credencial
  Tipo:            Circuloos Marketplace
  Titular:         Juan Pérez
  Dirección:       0xAbC...123
  Emisor:          did:alastria:...
  Fecha emisión:   9 de abril de 2026
  Válido hasta:    9 de abril de 2027
  ```

**Narración**:
> "EIP-712 es la diferencia entre firmar un hash opaco y firmar un formulario legible. El usuario ve exactamente qué está autorizando: quién emite, a quién, con qué datos. Esto es crítico para la confianza del usuario."

---

### ESCENA 7 — Diamond Pattern: contratos modulares
**Tipo**: Slide con diagrama  
**Duración**: ~35s

**Pantalla**:
- Diagrama EIP-2535:
  ```
  Llamada externa
        ↓
  [Diamond Proxy — dirección fija]
        ↓  (delegatecall según selector)
  ┌─────────────┬──────────────┬───────────────┐
  │TrustedIssuer│CredentialStat│   ProofFacet  │
  │   Facet     │    Facet     │               │
  └─────────────┴──────────────┴───────────────┘
  [DiamondCut] [DiamondLoupe] [Ownership]
  ```
- Bullet points a la derecha:
  - La dirección del contrato **nunca cambia**
  - Las facets son **upgradeable** individualmente
  - Supera el límite de 24KB por contrato EVM

**Narración**:
> "Los smart contracts usan el patrón Diamond de EIP-2535. Un único proxy central enruta las llamadas a facets intercambiables. Esto permite actualizar la lógica de negocio sin migrar datos ni cambiar la dirección del contrato."

---

## BLOQUE 3 — Demo: Ciclo de Vida Completo

---

### ESCENA 8 — Entorno levantado — Docker
**Tipo**: Terminal PowerShell  
**Duración**: ~25s

**Pantalla**:
- Mostrar resultado de `docker compose ps` con todos los servicios en estado `healthy`
- Destacar visualmente: `alastria-hardhat`, `alastria-issuer`, `alastria-verifier`, `alastria-web`, `alastria-deployer (Exited 0)`

```
NAME                  STATUS
alastria-hardhat      running (healthy)
alastria-deployer     exited (0)       ← desplegó contratos y terminó
alastria-issuer       running (healthy)
alastria-verifier     running (healthy)
alastria-web          running (healthy)
```

**Narración**:
> "Con un solo `docker compose up --build` el entorno completo arranca. El deployer ejecuta el despliegue de contratos y termina — su trabajo está hecho. El resto de servicios quedan corriendo y saludables."

---

### ESCENA 9 — Login del Emisor con SIWA
**Tipo**: Browser (`http://localhost:3000`)  
**Duración**: ~50s

**Pasos en pantalla**:
1. Abrir `http://localhost:3000` — mostrar la página de inicio
2. Clic en **"Conectar Wallet"**
3. MetaMask se abre — seleccionar cuenta del **Emisor**
4. Aparece el diálogo de firma SIWA (EIP-4361) — hacer zoom en el mensaje:
   - Se ve el dominio, la dirección, el nonce, la fecha
5. Clic **"Firmar"**
6. La app redirige al portal de emisor — sesión iniciada
7. Opcional: abrir DevTools → Application → Cookies → mostrar la cookie `JWT` con flag `HttpOnly`

**Narración**:
> "La autenticación usa SIWA — Sign-In With Alastria, basado en el estándar EIP-4361. No hay usuario ni contraseña. La identidad es la propia wallet. El backend valida la firma y establece una cookie JWT HttpOnly — completamente segura frente a XSS."

---

### ESCENA 10 — Preparar la credencial
**Tipo**: Browser (`http://localhost:3000/issuer`)  
**Duración**: ~40s

**Pasos en pantalla**:
1. Navegar al portal Issuer
2. Mostrar el formulario de emisión:
   - Campo: dirección Ethereum del Holder (`0x...`)
   - Campo: email del Holder (`holder@example.com`)
   - Campo: tipo de credencial: *Circuloos Marketplace*
3. Clic **"Preparar"**
4. Mostrar brevemente en DevTools (pestaña Network) la llamada `POST /api/v1/issue/prepare`
5. Respuesta: se muestra el ID de la credencial (`urn:uuid:...`) y el borrador del VC

**Narración**:
> "El emisor rellena el formulario con la dirección del titular y su email. Al preparar, el backend genera un borrador de credencial con ID único. En este punto aún no hay firma — es solo el draft."

---

### ESCENA 11 — Firma EIP-712 en MetaMask
**Tipo**: Browser + popup MetaMask  
**Duración**: ~35s

**Pasos en pantalla**:
1. Se abre MetaMask con el diálogo de firma EIP-712
2. Hacer **zoom** en los campos del mensaje estructurado:
   - `Acción: Emitir credencial de acceso`
   - `Tipo: Circuloos Marketplace`
   - `Titular: 0xHolder...`
   - `Emisor DID: did:alastria:...`
   - `Fecha emisión: 9 de abril de 2026`
   - `Válido hasta: 9 de abril de 2027`
3. Clic **"Firmar"**
4. Mostrar brevemente la llamada `POST /api/v1/issue/mint` en Network tab
5. Confirmación en la UI: *"Credencial emitida — email enviado al titular"*

**Narración**:
> "MetaMask muestra un formulario legible — no un hash. El emisor ve exactamente qué está firmando. Al confirmar, la firma se envía al backend que la registra en la blockchain y desencadena el envío del email al titular."

---

### ESCENA 12 — Email al Holder — Mailpit
**Tipo**: Browser (`http://localhost:8025`)  
**Duración**: ~20s

**Pasos en pantalla**:
1. Abrir Mailpit en `http://localhost:8025`
2. Mostrar el email recibido — asunto: *"Tu credencial está lista"*
3. Abrir el email — mostrar el link de claim (`http://localhost:3000/claim/...`)
4. Copiar o clic en el link

**Narración**:
> "En desarrollo usamos Mailpit como servidor SMTP local. El titular recibe un email con un link único y temporal para reclamar su credencial."

---

### ESCENA 13 — Holder reclama la credencial
**Tipo**: Browser (`/claim/...`) + MetaMask  
**Duración**: ~50s

**Pasos en pantalla**:
1. Abrir el link de claim en una ventana de incógnito (o cambiar cuenta MetaMask a la del **Holder**)
2. La página muestra el resumen de la credencial pendiente: emisor, tipo, fecha
3. Clic **"Conectar Wallet"** — MetaMask con la cuenta del Holder
4. Aparece diálogo de firma EIP-712 — hacer zoom:
   - `Acción: Reclamar mi credencial de acceso`
   - `Tipo: Circuloos Marketplace`
   - `Emisor: Circuloos`
   - `Dirección titular: 0xHolder...`
5. Firmar — llamada `POST /api/v1/issue/finalize`
6. La UI muestra: *"¡Credencial reclamada! Descarga tu VC"*

**Narración**:
> "El titular abre el link, conecta su propia wallet y firma para reclamar. El sistema valida que la dirección coincide con la del titular designado por el emisor y que el OTP del token es válido. Solo entonces entrega la credencial."

---

### ESCENA 14 — Descarga del VC (JSON y PDF)
**Tipo**: Browser — página de descarga  
**Duración**: ~25s

**Pasos en pantalla**:
1. Mostrar los botones de descarga: **"Descargar JSON"** y **"Descargar PDF"**
2. Descargar el JSON — abrirlo brevemente en el editor: mostrar la estructura W3C con campos `issuer`, `credentialSubject`, `proof.proofValue`
3. Descargar el PDF — abrirlo: mostrar la credencial visual

**Narración**:
> "El titular recibe dos formatos: el JSON con la credencial W3C completa incluyendo la firma EIP-712, y un PDF visual que además lleva el JSON completo incrustado en sus metadatos — es un documento auto-contenido y verificable."

---

### ESCENA 15 — Verificación pública de la credencial
**Tipo**: Browser (`http://localhost:3000/verify`)  
**Duración**: ~50s

**Pasos en pantalla**:
1. Abrir `http://localhost:3000/verify` — portal público, **sin necesidad de login**
2. Arrastrar o subir el archivo JSON descargado
3. El verifier procesa — mostrar los pasos con indicadores visuales si los hay:
   - ✅ Estructura W3C válida
   - ✅ Firma EIP-712 verificada
   - ✅ Emisor registrado como trusted en blockchain
   - ✅ Credencial activa (no revocada)
4. Resultado final: badge verde — *"Credencial VÁLIDA"*
5. Mostrar los detalles: emisor DID, titular, fecha de expiración, estado

**Narración**:
> "El portal de verificación es público — cualquiera puede acceder. Sube el JSON, y el sistema verifica en tres pasos: la estructura W3C, la firma criptográfica del emisor, y el estado on-chain en los smart contracts. Todo en segundos."

---

### ESCENA 16 — Revocación y re-verificación
**Tipo**: Swagger UI → Browser  
**Duración**: ~40s

**Pasos en pantalla**:
1. Abrir Swagger UI en `http://localhost:8001/docs`
2. Navegar a `POST /api/v1/credentials/{id}/revoke`
3. Expandir el endpoint — introducir el ID de la credencial
4. Ejecutar — respuesta `200 OK`
5. Volver al portal de verificación `http://localhost:3000/verify`
6. Subir el mismo JSON
7. Resultado: badge rojo — *"Credencial REVOCADA"* · `status: "revoked"`

**Narración**:
> "El emisor puede revocar una credencial en cualquier momento. La revocación queda registrada on-chain. Al volver a verificar el mismo archivo, el verifier consulta el contrato y devuelve el estado actualizado — la VC ya no es válida."

---

## BLOQUE 4 — Componentes Avanzados

---

### ESCENA 17 — MetaMask Snap: wallet de VCs
**Tipo**: Slide  
**Duración**: ~30s

**Pantalla**:
- Título: *"MetaMask Snap — Custodia segura de VCs"*
- Diagrama simple:
  ```
  MetaMask (extensión)
       └── Circuloos Snap
               ├── save_vc    → guarda VC cifrada
               ├── get_vcs    → lista tus credenciales
               ├── sign_vp    → firma Verifiable Presentation
               └── delete_vc  → elimina VC
  ```
- Bullet points:
  - Clave derivada BIP-44 — nunca se expone la clave raíz
  - Almacenamiento cifrado en el estado del Snap
  - Cada operación requiere confirmación nativa del usuario en MetaMask

**Narración**:
> "Más allá del flujo web, el proyecto incluye un MetaMask Snap que convierte tu wallet en una custodia de credenciales. Las VCs se almacenan cifradas. Para firmar una Verifiable Presentation, el Snap deriva una clave específica por BIP-44 — la clave raíz nunca sale de MetaMask."

---

### ESCENA 18 — PDF self-contained con metadatos XMP
**Tipo**: PDF viewer + editor de texto  
**Duración**: ~30s

**Pasos en pantalla**:
1. Abrir el PDF generado en el visor — mostrar el diseño visual de la credencial
2. Abrir el mismo PDF en un editor de texto (VS Code) — buscar `<xmp:Subject>`
3. Mostrar el bloque Base64 incrustado
4. Breve snippet: decodificar manualmente el Base64 con Node en terminal:
   ```powershell
   node -e "const pdf=require('fs').readFileSync('credential.pdf','utf8'); const m=pdf.match(/xmp:Subject[^>]*>([^<]+)/); console.log(Buffer.from(m[1],'base64').toString('utf8').slice(0,200))"
   ```
5. El JSON de la VC aparece en consola

**Narración**:
> "El PDF no es solo visual. Lleva la VC completa incrustada en metadatos XMP, codificada en Base64. Esto lo hace auto-contenido: el emisor podría desaparecer y la credencial sigue siendo verificable extrayendo el JSON del propio PDF."

---

## BLOQUE 5 — Cierre

---

### ESCENA 19 — Despliegue en red real Alastria
**Tipo**: Slide  
**Duración**: ~30s

**Pantalla**:
- Título: *"De local a producción"*
- Dos columnas:
  - *Desarrollo local*: Hardhat · `chainId: 31337` · claves de test
  - *Alastria Red-T*: `https://rpc.alastria.io/alastria-t` · `chainId: 2020` · identidades reales
- Cambio mínimo necesario:
  ```env
  RPC_URL=https://rpc.alastria.io/alastria-t
  CHAIN_ID=2020
  ```
- Bullet: extensibilidad — nuevo tipo de credencial = nuevo schema EIP-712 en `libs/common/src/eip712/`

**Narración**:
> "Pasar de local a la red real de Alastria es cambiar dos variables de entorno. La arquitectura es la misma. Y añadir un nuevo tipo de credencial — académica, laboral, de acceso — solo requiere registrar un nuevo schema EIP-712 en la librería compartida."

---

### ESCENA 20 — Cierre
**Tipo**: Slide  
**Duración**: ~15s

**Pantalla**:
- Título: *"CIRCULOOS Identity Platform"*
- Tagline: *"Credenciales portables · Identidad soberana · Blockchain Alastria"*
- Stack resumido en iconos: Solidity · Node.js · Next.js · MetaMask · W3C · EIP-712
- Enlace al repositorio / contacto

**Narración**:
> "Identidad digital soberana, sobre estándares abiertos, en la red Alastria."

---

## Checklist Pre-Grabación

- [ ] Docker Desktop corriendo — `docker compose ps` todos `healthy`
- [ ] MetaMask con **2 cuentas** configuradas: Emisor (cuenta 1) y Holder (cuenta 2)
- [ ] Mailpit abierto en pestaña: `http://localhost:8025`
- [ ] Swagger UI abierto en pestaña: `http://localhost:8001/docs`
- [ ] VS Code abierto con el repositorio en el explorador de archivos
- [ ] Ventana de incógnito lista para la escena del Holder
- [ ] Resolución de grabación: 1920×1080
- [ ] Notificaciones del sistema desactivadas (modo No Molestar)
- [ ] Audio probado sin ruido de fondo
