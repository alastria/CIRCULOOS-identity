# Dashboard IoT (`/admin/iot`) — D1.11

Sección de fleet view para los dispositivos IoT del piloto (repo separado
`CIRCULOOS-iot-identity`, ADR-001). Solo lectura: lista dispositivos
aprovisionados con su última atestación y estado, y permite entrar al detalle
de un dispositivo para ver sus atestaciones paginadas con verificación de
firma EIP-191 hecha en el propio cliente (no se confía en que el contrato ya
la validó — se recompone desde el calldata de cada tx y se recupera la
dirección firmante).

## Por qué no usa `private-db` ni `mock-issuer` para las atestaciones

`AttestationRegistry.sol` no expone ninguna función de lectura (solo
`attest(bytes32,bytes)` y el evento `Attested`). El listado de dispositivos y
el historial por dispositivo se obtienen **enteramente on-chain**, escaneando
el evento `Attested` (filtrado por `device` para el detalle) y decodificando
el calldata de cada tx para verificar la firma — sin depender de ningún
backend adicional para el dato principal. Ventaja: es exactamente lo que hace
el contrato al recibir `attest()`, reproducido en cliente, no una confianza
ciega en un servicio intermedio.

La única llamada a un servicio del piloto es `GET /devices` de `mock-issuer`
(añadido en este mismo bloque), y solo para resolver el **alias** legible
(`deviceId`, ej. `PI-DEMO-0001`) a partir de la `address` — dato que no existe
en ninguna forma on-chain. Si `mock-issuer` no está disponible, el listado
sigue funcionando mostrando solo direcciones.

## Cómo probarlo

1. Levanta el piloto completo desde `CIRCULOOS-iot-identity` (repo hermano):
   ```bash
   cd ../../CIRCULOOS-iot-identity   # o la ruta donde tengas ese repo
   npm run pilot:up
   npm run pilot:check               # confirma que hay attestations on-chain
   ```
   Espera un par de minutos (varios ticks de cada `pi-agent`) para tener
   suficientes atestaciones para ver la paginación del detalle (≥10).

2. En `apps/web`, configura `.env.local` (copia de `.env.example`) con al menos:
   ```
   NEXT_PUBLIC_RPC_URL=http://localhost:8545
   NEXT_PUBLIC_CHAIN_ID=31337
   NEXT_PUBLIC_ATTESTATION_REGISTRY_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
   NEXT_PUBLIC_IOT_MOCK_ISSUER_URL=http://localhost:8001
   NEXT_PUBLIC_ADMIN_ADDRESSES=0xTuDireccionDeWallet
   ```
   La dirección del registro es determinista mientras no borres los volúmenes
   del piloto (`npm run pilot:down` los borra — tras un `pilot:up` limpio,
   verifícala si hace falta con el log de `deployer` o `pilot-check.mjs`).

3. `pnpm dev` (o `dev:local`) en `apps/web`, conecta una wallet en la red
   **Hardhat Local** (ya configurada en `src/shared/config/wagmi.ts`) que sea
   admin (`NEXT_PUBLIC_ADMIN_ADDRESSES` o owner del Diamond), entra a
   `/admin` → **Dispositivos IoT** en el sidebar.

4. Deberías ver el listado con los 3 dispositivos del piloto
   (`PI-DEMO-0001`..`0003`), su última atestación y estado. Entra al detalle
   de uno para ver sus atestaciones con timestamp y verificación de firma
   (✓ verde si la firma recuperada coincide con la address del dispositivo).

## Restricciones respetadas

- No se implementa revocación desde el dashboard (llega en F2, D2.4) — el
  estado "revocado" ni siquiera se calcula todavía, solo "activo"/"sin
  actividad reciente".
- No se tocó ningún componente de la sección de usuarios humanos (issuers,
  revoke, config) — solo se añadió una entrada al array de navegación de
  `admin-layout.tsx` y nuevas claves i18n, sin modificar las existentes.
