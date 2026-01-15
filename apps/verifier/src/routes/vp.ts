/**
 * VP Verification Routes
 * 
 * Endpoints for verifying Verifiable Presentations (VPs)
 * Used by Kong Gateway plugin to validate authentication tokens
 */

import { FastifyPluginAsync } from "fastify";
import { utils } from "ethers";
import { verifySignedCredential } from "@circuloos/common";
import { config } from "../config";
import { createHash } from "crypto";

interface EIP712Domain {
  name: string;
  version: string;
  chainId: number;
}

interface VerifiablePresentation {
  "@context": string[];
  type: string[];
  verifiableCredential: any[];
  holder: string;
  issuanceDate?: string;
  expirationDate?: string;
}

interface SignedVP {
  presentation: VerifiablePresentation;
  signature: string;
  signer: string;
  domain: EIP712Domain;
  challenge?: string; // Optional challenge for anti-replay
}

/**
 * Decode VP token from base64
 */
function decodeVPToken(token: string): SignedVP {
  try {
    const json = Buffer.from(token, "base64").toString("utf-8");
    return JSON.parse(json);
  } catch (error) {
    throw new Error("Invalid VP token format");
  }
}

/**
 * Verify VP signature using EIP-712
 * Supports challenge for anti-replay protection
 */
async function verifyVPSignature(signedVP: SignedVP): Promise<boolean> {
  try {
    const { presentation, signature, signer, domain, challenge } = signedVP;

    // EIP-712 types for Presentation (with optional challenge)
    const types = challenge
      ? {
        Presentation: [
          { name: "holder", type: "address" },
          { name: "verifiableCredential", type: "string" },
          { name: "issuanceDate", type: "string" },
          { name: "expirationDate", type: "string" },
          { name: "challenge", type: "string" },
        ],
      }
      : {
        Presentation: [
          { name: "holder", type: "address" },
          { name: "verifiableCredential", type: "string" },
          { name: "issuanceDate", type: "string" },
          { name: "expirationDate", type: "string" },
        ],
      };

    // Message that was signed
    const message: any = {
      holder: presentation.holder,
      verifiableCredential: JSON.stringify(presentation.verifiableCredential),
      issuanceDate: presentation.issuanceDate || "",
      expirationDate: presentation.expirationDate || "",
    };

    // Include challenge if present
    if (challenge) {
      message.challenge = challenge;
    }

    // Recover signer from signature using ethers v5 API
    const recovered = utils.verifyTypedData(domain, types, message, signature);

    // Check if recovered address matches claimed signer
    return recovered.toLowerCase() === signer.toLowerCase();
  } catch (error) {
    return false;
  }
}

/**
 * Check if VP has expired
 */
function isVPExpired(presentation: VerifiablePresentation): boolean {
  if (!presentation.expirationDate) {
    return false; // No expiration set
  }

  const now = new Date();
  const expiration = new Date(presentation.expirationDate);
  return now > expiration;
}

/**
 * Verify holder matches signer
 */
function verifyHolderMatch(presentation: VerifiablePresentation, signer: string): boolean {
  return presentation.holder.toLowerCase() === signer.toLowerCase();
}

/**
 * Calculate VP hash for batching
 * Uses keccak256 of the VP presentation data + signature
 */
function calculateVPHash(signedVP: SignedVP): string {
  // Create deterministic representation of VP
  const vpData = JSON.stringify({
    presentation: signedVP.presentation,
    signer: signedVP.signer,
    signature: signedVP.signature
  })

  // Hash it with keccak256 (same as Solidity)
  const hash = utils.keccak256(utils.toUtf8Bytes(vpData))
  return hash
}

const vpRoutes: FastifyPluginAsync = async (server) => {
  // Note: We access challengeService and batchService dynamically from the server
  // in each handler, not captured here, to allow test mocking

  /**
   * POST /marketplace/auth/challenge
   * 
   * Generate a challenge for anti-replay protection
   * The holder must include this challenge when signing the VP
   */
  server.post("/marketplace/auth/challenge", {
    schema: {
      tags: ["vp", "marketplace"],
      summary: "Generate challenge for VP anti-replay",
      body: {
        type: "object",
        properties: {
          holderAddress: { type: "string" },
        },
        required: ["holderAddress"],
      },
      response: {
        200: {
          type: "object",
          properties: {
            challenge: { type: "string" },
            expiresAt: { type: "number" },
          },
        },
      },
    },
  }, async (request, reply) => {
    const challengeService = (server as any).challengeService
    const body: any = request.body

    if (!body || !body.holderAddress) {
      return reply.status(400).send({
        error: "Missing required field: holderAddress",
      })
    }

    if (!challengeService) {
      return reply.status(503).send({
        error: "Challenge service not available",
      })
    }

    try {
      const { challenge, expiresAt } = challengeService.generateChallenge(body.holderAddress)
      return {
        challenge,
        expiresAt,
      }
    } catch (error: any) {
      request.log.error({ error }, "Failed to generate challenge")
      return reply.status(500).send({
        error: "Failed to generate challenge",
      })
    }
  })

  /**
   * POST /verify-vp
   * 
   * Verify a complete Verifiable Presentation with signature
   * Used for detailed verification with full response
   * Now supports challenge validation for anti-replay
   */
  server.post("/verify-vp", {
    schema: {
      tags: ["vp"],
      summary: "Verify a full Verifiable Presentation",
      body: { type: "object", additionalProperties: true },
      response: {
        200: { type: "object", properties: { ok: { type: "boolean" } }, additionalProperties: true },
        401: { type: "object", properties: { ok: { type: "boolean" }, error: { type: "string" } }, additionalProperties: true },
      },
    },
  }, async (request, reply) => {
    const challengeService = (server as any).challengeService
    const batchService = (server as any).batchService
    const body: any = request.body;

    if (!body || !body.presentation || !body.signature || !body.signer) {
      return reply.status(400).send({
        ok: false,
        error: "Missing required fields: presentation, signature, signer",
      });
    }

    const signedVP: SignedVP = body;

    // Check if VP has expired
    if (isVPExpired(signedVP.presentation)) {
      return reply.status(401).send({
        ok: false,
        error: "VP has expired",
        expirationDate: signedVP.presentation.expirationDate,
      });
    }

    // Verify holder matches signer
    if (!verifyHolderMatch(signedVP.presentation, signedVP.signer)) {
      return reply.status(401).send({
        ok: false,
        error: "Holder address does not match signer",
        holder: signedVP.presentation.holder,
        signer: signedVP.signer,
      });
    }

    // Verify challenge if present (anti-replay protection)
    if (signedVP.challenge && challengeService) {
      const challengeValid = challengeService.validateAndConsume(
        signedVP.challenge,
        signedVP.signer
      )
      if (!challengeValid) {
        return reply.status(401).send({
          ok: false,
          error: "Invalid or expired challenge",
        })
      }
    }

    // Verify VP signature
    const signatureValid = await verifyVPSignature(signedVP);
    if (!signatureValid) {
      return reply.status(401).send({
        ok: false,
        error: "Invalid VP signature",
      });
    }

    // Verify each embedded VC
    const vcResults = [];
    const trustedIssuers = config.trustedIssuers;

    for (const vc of signedVP.presentation.verifiableCredential) {
      try {
        const result = verifySignedCredential(vc, {
          trustedIssuers: trustedIssuers.length ? trustedIssuers : undefined,
          requireW3CCompliance: true,
        });

        if (!result.issuer.ok) {
          return reply.status(401).send({
            ok: false,
            error: "Invalid VC in presentation",
            vcError: result.issuer.reason,
            vc: vc.vc?.id,
          });
        }

        vcResults.push({
          vcId: vc.vc?.id,
          issuer: result.issuer,
        });
      } catch (error) {
        return reply.status(401).send({
          ok: false,
          error: "Failed to verify VC",
          vcError: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // All checks passed - VP is valid!

    // Add VP to batch queue (async, non-blocking)
    if (batchService) {
      try {
        const vpHash = calculateVPHash(signedVP)
        batchService.addVP(vpHash, signedVP.signer, {
          verifiedAt: Date.now(),
          challenge: signedVP.challenge
        })
      } catch (batchError) {
        // Log error but don't fail the verification
        console.error('[VP] Failed to add VP to batch queue:', batchError)
      }
    }

    return {
      ok: true,
      holder: signedVP.signer,
      vcs: vcResults,
      expirationDate: signedVP.presentation.expirationDate,
      vpHash: batchService ? calculateVPHash(signedVP) : undefined
    };
  });

  /**
   * POST /verify-vp/quick
   * 
   * Quick VP verification for Kong Gateway
   * Returns minimal response for auth decisions
   */
  server.post("/verify-vp/quick", {
    schema: {
      tags: ["vp"],
      summary: "Quick VP verification for gateways",
      response: {
        200: { type: "object", properties: { ok: { type: "boolean" }, holder: { type: "string" } } },
        401: { type: "object", properties: { ok: { type: "boolean" }, error: { type: "string" } } },
      },
    },
  }, async (request, reply) => {
    const challengeService = (server as any).challengeService
    try {
      // Extract token from Authorization header
      const authHeader = request.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return reply.status(401).send({
          ok: false,
          error: "Missing or invalid Authorization header",
        });
      }

      const token = authHeader.substring(7); // Remove "Bearer "

      // Decode VP token
      let signedVP: SignedVP;
      try {
        signedVP = decodeVPToken(token);
      } catch (error) {
        return reply.status(401).send({
          ok: false,
          error: "Invalid token format",
        });
      }

      // Quick checks
      if (isVPExpired(signedVP.presentation)) {
        return reply.status(401).send({ ok: false, error: "expired" });
      }

      if (!verifyHolderMatch(signedVP.presentation, signedVP.signer)) {
        return reply.status(401).send({ ok: false, error: "holder_mismatch" });
      }

      // Verify challenge if present (anti-replay protection)
      if (signedVP.challenge && challengeService) {
        const challengeValid = challengeService.validateAndConsume(
          signedVP.challenge,
          signedVP.signer
        )
        if (!challengeValid) {
          return reply.status(401).send({ ok: false, error: "invalid_challenge" })
        }
      }

      const signatureValid = await verifyVPSignature(signedVP);
      if (!signatureValid) {
        return reply.status(401).send({ ok: false, error: "invalid_signature" });
      }

      // Quick VC validation (at least verify issuer signature)
      const trustedIssuers = config.trustedIssuers;

      for (const vc of signedVP.presentation.verifiableCredential) {
        const result = verifySignedCredential(vc, {
          trustedIssuers: trustedIssuers.length ? trustedIssuers : undefined,
        });

        if (!result.issuer.ok) {
          return reply.status(401).send({
            ok: false,
            error: "invalid_vc",
          });
        }
      }

      // Success - return minimal response for Kong
      return reply
        .status(200)
        .header("X-VP-Holder", signedVP.signer)
        .header("X-VP-Valid-Until", signedVP.presentation.expirationDate || "")
        .send({
          ok: true,
          holder: signedVP.signer,
        });
      /* istanbul ignore start - generic error logging, no specific business logic */
    } catch (error) {
      return reply.status(500).send({
        ok: false,
        error: "internal_error",
      });
    }
  });

  /**
   * GET /marketplace/auth/proof/:vpHash
   *
   * Get Merkle proof for a specific VP hash
   * Used to verify that a VP is included in a batch on-chain
   */
  server.get("/marketplace/auth/proof/:vpHash", {
    schema: {
      tags: ["vp", "marketplace", "batch"],
      summary: "Get Merkle proof for VP",
      params: {
        type: "object",
        properties: {
          vpHash: { type: "string", description: "Hash of the VP (0x...)" }
        },
        required: ["vpHash"]
      },
      response: {
        200: {
          type: "object",
          properties: {
            vpHash: { type: "string" },
            batchId: { type: "number" },
            merkleRoot: { type: "string" },
            proof: { type: "array", items: { type: "string" } },
            index: { type: "number" }
          }
        },
        404: {
          type: "object",
          properties: {
            error: { type: "string" }
          }
        }
      }
    }
  }, async (request, reply) => {
    const batchService = (server as any).batchService
    const { vpHash } = request.params as { vpHash: string }

    if (!batchService) {
      return reply.status(503).send({
        error: "Batch service not available"
      })
    }

    try {
      const proof = batchService.getMerkleProof(vpHash)

      if (!proof) {
        return reply.status(404).send({
          error: "VP not found in any batch"
        })
      }

      return {
        vpHash: proof.vpHash,
        batchId: proof.batchId,
        merkleRoot: proof.root,
        proof: proof.proof,
        index: proof.index
      }
    } catch (error) {
      return reply.status(500).send({
        error: error instanceof Error ? error.message : "Internal error"
      })
    }
  })

  /**
   * GET /marketplace/batch/:batchId
   *
   * Get information about a specific batch
   */
  server.get("/marketplace/batch/:batchId", {
    schema: {
      tags: ["vp", "marketplace", "batch"],
      summary: "Get batch information",
      params: {
        type: "object",
        properties: {
          batchId: { type: "number" }
        },
        required: ["batchId"]
      },
      response: {
        200: {
          type: "object",
          properties: {
            batchId: { type: "number" },
            merkleRoot: { type: "string" },
            vpCount: { type: "number" },
            timestamp: { type: "number" },
            ipfsCid: { type: "string" },
            attester: { type: "string" }
          }
        },
        404: {
          type: "object",
          properties: {
            error: { type: "string" }
          }
        }
      }
    }
  }, async (request, reply) => {
    const batchService = (server as any).batchService
    const { batchId } = request.params as { batchId: number }

    if (!batchService) {
      return reply.status(503).send({
        error: "Batch service not available"
      })
    }

    try {
      const batch = batchService.getBatch(batchId)

      if (!batch) {
        return reply.status(404).send({
          error: "Batch not found"
        })
      }

      return batch
    } catch (error) {
      return reply.status(500).send({
        error: error instanceof Error ? error.message : "Internal error"
      })
    }
  })

  /**
   * GET /marketplace/batch/stats
   *
   * Get batching statistics
   */
  server.get("/marketplace/batch/stats", {
    schema: {
      tags: ["vp", "marketplace", "batch"],
      summary: "Get batch statistics",
      response: {
        200: {
          type: "object",
          properties: {
            totalBatches: { type: "number" },
            totalVPs: { type: "number" },
            pendingVPs: { type: "number" },
            lastBatchTimestamp: { type: "number" },
            averageVPsPerBatch: { type: "number" }
          }
        }
      }
    }
  }, async (request, reply) => {
    const batchService = (server as any).batchService
    if (!batchService) {
      return reply.status(503).send({
        error: "Batch service not available"
      })
    }

    try {
      const stats = batchService.getStats()
      return stats
    } catch (error) {
      return reply.status(500).send({
        error: error instanceof Error ? error.message : "Internal error"
      })
    }
  })

  /**
   * GET /verify-vp/health
   *
   * Health check for Kong to monitor service availability
   */
  server.get("/verify-vp/health", {
    schema: {
      tags: ["vp"],
      response: { 200: { type: "object", properties: { ok: { type: "boolean" }, service: { type: "string" }, timestamp: { type: "string" } } } },
    },
  }, async () => {
    return {
      ok: true,
      service: "vp-verifier",
      timestamp: new Date().toISOString(),
    };
  });
};

export default vpRoutes;
