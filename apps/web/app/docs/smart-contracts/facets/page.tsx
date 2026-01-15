import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, ArrowRight, Diamond, Shield, FileCheck, Users, Layers } from "lucide-react"

export default function SmartContractFacetsPage() {
  return (
    <div className="space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/docs" className="hover:text-foreground">Docs</Link>
        <span>/</span>
        <Link href="/docs/smart-contracts/facets" className="hover:text-foreground">Smart Contracts</Link>
        <span>/</span>
        <span className="text-foreground">Facets Reference</span>
      </div>

      {/* Title */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Badge className="bg-orange-500/10 text-orange-600 dark:text-orange-400">
            Solidity
          </Badge>
          <Badge variant="outline">EIP-2535</Badge>
        </div>
        <h1 className="text-4xl font-bold tracking-tight">Smart Contract Facets</h1>
        <p className="text-xl text-muted-foreground">
          Referencia completa de los Facets del Diamond Pattern. Cada facet implementa
          una funcionalidad específica del sistema de credenciales verificables.
        </p>
      </div>

      {/* Overview */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold" id="overview">Arquitectura de Facets</h2>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="pb-2">
              <Users className="h-5 w-5 text-blue-500 mb-2" />
              <CardTitle className="text-base">TrustedIssuerFacet</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Gestión del registro de emisores autorizados.
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="pb-2">
              <FileCheck className="h-5 w-5 text-green-500 mb-2" />
              <CardTitle className="text-base">CredentialStatusFacet</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Estados de credenciales: activas, revocadas, suspendidas.
              </p>
            </CardContent>
          </Card>



          <Card className="border-l-4 border-l-orange-500">
            <CardHeader className="pb-2">
              <Layers className="h-5 w-5 text-orange-500 mb-2" />
              <CardTitle className="text-base">AttestationBatchFacet</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Batch de attestations para gas efficiency.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* TrustedIssuerFacet */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold flex items-center gap-2" id="trusted-issuer">
          <Users className="h-6 w-6 text-blue-500" />
          TrustedIssuerFacet
        </h2>

        <p className="text-muted-foreground">
          Gestiona el registro de emisores de confianza (Trusted Issuers). Solo los emisores
          registrados pueden emitir credenciales verificables válidas en el ecosistema Alastria.
        </p>

        <Card className="overflow-hidden">
          <CardHeader className="bg-muted/30">
            <CardTitle className="text-lg font-mono">ITrustedIssuerFacet.sol</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <pre className="p-4 text-sm overflow-x-auto">
              {`// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ITrustedIssuerFacet {
    /// @notice Registra un nuevo emisor de confianza
    /// @param issuer Dirección del emisor
    /// @param metadata Información adicional (nombre, URL, etc.)
    function addTrustedIssuer(
        address issuer, 
        string calldata metadata
    ) external;

    /// @notice Elimina un emisor del registro
    /// @param issuer Dirección del emisor a eliminar
    function removeTrustedIssuer(address issuer) external;

    /// @notice Verifica si una dirección es emisor de confianza
    /// @param issuer Dirección a verificar
    /// @return isTrusted true si es emisor de confianza
    function isTrustedIssuer(
        address issuer
    ) external view returns (bool isTrusted);

    /// @notice Obtiene información de un emisor
    /// @param issuer Dirección del emisor
    /// @return metadata Información del emisor
    function getIssuerInfo(
        address issuer
    ) external view returns (string memory metadata);

    /// @notice Lista todos los emisores registrados
    /// @return issuers Array de direcciones de emisores
    function getAllIssuers() external view returns (address[] memory issuers);

    // Events
    event TrustedIssuerAdded(address indexed issuer, string metadata);
    event TrustedIssuerRemoved(address indexed issuer);
}`}
            </pre>
          </CardContent>
        </Card>

        <Card className="bg-blue-500/5 border-blue-500/20">
          <CardContent className="pt-4">
            <h4 className="font-semibold mb-2">💡 Uso desde JavaScript</h4>
            <pre className="text-sm overflow-x-auto">
              {`import { ethers } from 'ethers';
import { DIAMOND_ABI } from '@alastria/contracts';

const diamond = new ethers.Contract(DIAMOND_ADDRESS, DIAMOND_ABI, signer);

// Verificar si es emisor de confianza
const isTrusted = await diamond.isTrustedIssuer(issuerAddress);

// Añadir emisor (solo admin)
await diamond.addTrustedIssuer(
  '0x1234...', 
  JSON.stringify({ name: 'Universidad', url: 'https://...' })
);`}
            </pre>
          </CardContent>
        </Card>
      </section>

      {/* CredentialStatusFacet */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold flex items-center gap-2" id="credential-status">
          <FileCheck className="h-6 w-6 text-green-500" />
          CredentialStatusFacet
        </h2>

        <p className="text-muted-foreground">
          Gestiona el estado de las credenciales on-chain. Permite registrar, revocar y
          suspender credenciales de forma inmutable y verificable.
        </p>

        <Card className="overflow-hidden">
          <CardHeader className="bg-muted/30">
            <CardTitle className="text-lg font-mono">ICredentialStatusFacet.sol</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <pre className="p-4 text-sm overflow-x-auto">
              {`// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ICredentialStatusFacet {
    enum CredentialStatus {
        NotRegistered,  // 0: No existe en el registro
        Active,         // 1: Credencial válida
        Revoked,        // 2: Revocada permanentemente
        Suspended       // 3: Temporalmente inválida
    }

    /// @notice Registra una nueva credencial
    /// @param credentialHash Hash de la credencial
    function registerCredential(bytes32 credentialHash) external;

    /// @notice Revoca una credencial (irreversible)
    /// @param credentialHash Hash de la credencial
    /// @param reason Motivo de revocación
    function revokeCredential(
        bytes32 credentialHash, 
        string calldata reason
    ) external;

    /// @notice Suspende temporalmente una credencial
    /// @param credentialHash Hash de la credencial
    function suspendCredential(bytes32 credentialHash) external;

    /// @notice Reactiva una credencial suspendida
    /// @param credentialHash Hash de la credencial
    function unsuspendCredential(bytes32 credentialHash) external;

    /// @notice Obtiene el estado de una credencial
    /// @param credentialHash Hash de la credencial
    /// @return status Estado actual de la credencial
    function getCredentialStatus(
        bytes32 credentialHash
    ) external view returns (CredentialStatus status);

    /// @notice Verifica si una credencial está activa
    /// @param credentialHash Hash de la credencial
    /// @return isActive true si está activa
    function isCredentialActive(
        bytes32 credentialHash
    ) external view returns (bool isActive);

    // Events
    event CredentialRegistered(bytes32 indexed hash, address indexed issuer);
    event CredentialRevoked(bytes32 indexed hash, string reason);
    event CredentialSuspended(bytes32 indexed hash);
    event CredentialUnsuspended(bytes32 indexed hash);
}`}
            </pre>
          </CardContent>
        </Card>

        <Card className="bg-yellow-500/5 border-yellow-500/20">
          <CardContent className="pt-4">
            <h4 className="font-semibold mb-2">⚠️ Consideraciones Importantes</h4>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li><strong>Revocación es permanente:</strong> Una vez revocada, no se puede revertir</li>
              <li><strong>Suspensión es temporal:</strong> Se puede reactivar con <code>unsuspendCredential</code></li>
              <li><strong>Solo el issuer:</strong> Solo el emisor original puede cambiar el estado</li>
              <li><strong>Hash determinístico:</strong> Se calcula del contenido de la credencial</li>
            </ul>
          </CardContent>
        </Card>
      </section>



      {/* AttestationBatchFacet */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold flex items-center gap-2" id="batch">
          <Layers className="h-6 w-6 text-orange-500" />
          AttestationBatchFacet
        </h2>

        <p className="text-muted-foreground">
          Optimiza el registro de múltiples credenciales en una sola transacción.
          Reduce significativamente los costes de gas cuando se emiten credenciales en lote.
        </p>

        <Card className="overflow-hidden">
          <CardHeader className="bg-muted/30">
            <CardTitle className="text-lg font-mono">IAttestationBatchFacet.sol</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <pre className="p-4 text-sm overflow-x-auto">
              {`// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IAttestationBatchFacet {
    /// @notice Registra múltiples credenciales en una transacción
    /// @param hashes Array de hashes de credenciales
    function batchRegister(bytes32[] calldata hashes) external;

    /// @notice Revoca múltiples credenciales
    /// @param hashes Array de hashes a revocar
    /// @param reason Motivo común de revocación
    function batchRevoke(
        bytes32[] calldata hashes, 
        string calldata reason
    ) external;

    /// @notice Crea una attestation con Merkle root
    /// @param merkleRoot Root del árbol Merkle de credenciales
    /// @param count Número de credenciales en el batch
    function createBatchAttestation(
        bytes32 merkleRoot, 
        uint256 count
    ) external returns (uint256 batchId);

    /// @notice Verifica inclusión en un batch via Merkle proof
    /// @param batchId ID del batch
    /// @param credentialHash Hash de la credencial
    /// @param proof Merkle proof
    /// @return included true si está incluida en el batch
    function verifyBatchInclusion(
        uint256 batchId,
        bytes32 credentialHash,
        bytes32[] calldata proof
    ) external view returns (bool included);

    // Events
    event BatchRegistered(uint256 indexed batchId, bytes32 merkleRoot);
    event BatchRevoked(uint256 indexed batchId, string reason);
}`}
            </pre>
          </CardContent>
        </Card>

        <Card className="bg-orange-500/5 border-orange-500/20">
          <CardContent className="pt-4">
            <h4 className="font-semibold mb-2">⛽ Comparación de Gas</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3">Operación</th>
                    <th className="text-left py-2 px-3">Gas Individual</th>
                    <th className="text-left py-2 px-3">Gas Batch (10)</th>
                    <th className="text-left py-2 px-3">Ahorro</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="py-2 px-3">Registro</td>
                    <td className="py-2 px-3">~45,000</td>
                    <td className="py-2 px-3">~120,000</td>
                    <td className="py-2 px-3 text-green-600">~73%</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3">Revocación</td>
                    <td className="py-2 px-3">~35,000</td>
                    <td className="py-2 px-3">~80,000</td>
                    <td className="py-2 px-3 text-green-600">~77%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Diamond Storage */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold" id="storage">Diamond Storage Pattern</h2>

        <p className="text-muted-foreground">
          Cada facet usa su propio slot de storage aislado para evitar colisiones.
          El slot se calcula como el hash del namespace del facet.
        </p>

        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <pre className="p-4 text-sm overflow-x-auto">
              {`// LibTrustedIssuerStorage.sol
library LibTrustedIssuerStorage {
    bytes32 constant STORAGE_POSITION = 
        keccak256("alastria.diamond.storage.TrustedIssuer");

    struct Storage {
        mapping(address => bool) issuers;
        mapping(address => string) issuerMetadata;
        address[] issuerList;
    }

    function diamondStorage() internal pure returns (Storage storage ds) {
        bytes32 position = STORAGE_POSITION;
        assembly {
            ds.slot := position
        }
    }
}

// Uso en el Facet
function isTrustedIssuer(address issuer) external view returns (bool) {
    return LibTrustedIssuerStorage.diamondStorage().issuers[issuer];
}`}
            </pre>
          </CardContent>
        </Card>
      </section>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-8 border-t">
        <Link
          href="/docs/api/verifier"
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Verifier API
        </Link>
        <Link
          href="/docs/security/eip712"
          className="flex items-center gap-2 text-primary hover:underline"
        >
          EIP-712 Security
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  )
}
