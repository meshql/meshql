import type { MeshInstance } from "../../index.js";
import type { MeshPlugin } from "../../plugin/types.js";
import { IntegrityError } from "../../errors/index.js";
import { verifyQuerySignature } from "../../crypto/hmac.js";

/** Options for basic HMAC integrity verification. */
export interface BasicIntegrityOptions {
  secret: string;
}

/** Register basic HMAC integrity verification on a mesh instance. */
export function withBasicIntegrity(
  mesh: MeshInstance,
  options: BasicIntegrityOptions,
): MeshInstance {
  return mesh.use(basicIntegrityPlugin(options));
}

/** Create a basic HMAC integrity plugin. */
export function basicIntegrityPlugin(
  options: BasicIntegrityOptions,
): MeshPlugin {
  return {
    name: "basic-integrity",

    onRequest(raw, ctx) {
      const transport = ctx.transport;
      if (!transport?.queryHeader) {
        throw new IntegrityError("Missing X-Mesh-Query header for verification");
      }

      const signature = transport.signature;
      if (!signature) {
        throw new IntegrityError("Missing X-Mesh-Signature header");
      }

      const valid = verifyQuerySignature(
        options.secret,
        transport.queryHeader,
        signature,
      );

      if (!valid) {
        throw new IntegrityError("Signature verification failed");
      }

      return raw;
    },
  };
}
