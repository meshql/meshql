import type { MeshFile } from "@meshql/core";
import type { StorageAdapter } from "./types.js";

/** Options for the S3-compatible storage adapter. */
export interface S3StorageOptions {
  bucket: string;
  region?: string;
  endpoint?: string;
  forcePathStyle?: boolean;
  /**
   * When true, {@link StorageAdapter.get} returns a presigned URL string
   * encoded as UTF-8 bytes. Default reads the object body as a Buffer.
   */
  getAsPresignedUrl?: boolean;
  presignExpiresIn?: number;
  /** Optional credentials; falls back to the default AWS credential chain. */
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;
  };
}

type S3ClientLike = {
  send(command: unknown): Promise<unknown>;
};

/**
 * Create an S3 storage adapter.
 *
 * Requires `@aws-sdk/client-s3` (and `@aws-sdk/s3-request-presigner` when
 * `getAsPresignedUrl` is enabled) as peer dependencies.
 */
export function createS3Storage(options: S3StorageOptions): StorageAdapter {
  let clientPromise: Promise<S3ClientLike> | undefined;

  async function getClient(): Promise<S3ClientLike> {
    if (!clientPromise) {
      clientPromise = (async () => {
        try {
          const mod = await import("@aws-sdk/client-s3");
          return new mod.S3Client({
            region: options.region ?? "us-east-1",
            endpoint: options.endpoint,
            forcePathStyle: options.forcePathStyle,
            credentials: options.credentials,
          }) as S3ClientLike;
        } catch {
          throw new Error(
            "S3 storage requires `@aws-sdk/client-s3`. Install it to use storage: \"s3\".",
          );
        }
      })();
    }
    return clientPromise;
  }

  return {
    async put(file: MeshFile, key: string) {
      const mod = await import("@aws-sdk/client-s3");
      const client = await getClient();
      await client.send(
        new mod.PutObjectCommand({
          Bucket: options.bucket,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
        }),
      );
      return key;
    },

    async get(key: string) {
      if (options.getAsPresignedUrl) {
        const mod = await import("@aws-sdk/client-s3");
        const presigner = await import("@aws-sdk/s3-request-presigner");
        const client = await getClient();
        const command = new mod.GetObjectCommand({
          Bucket: options.bucket,
          Key: key,
        });
        const url = await presigner.getSignedUrl(client as never, command, {
          expiresIn: options.presignExpiresIn ?? 3600,
        });
        return Buffer.from(url, "utf8");
      }

      const mod = await import("@aws-sdk/client-s3");
      const client = await getClient();
      const result = (await client.send(
        new mod.GetObjectCommand({
          Bucket: options.bucket,
          Key: key,
        }),
      )) as { Body?: { transformToByteArray(): Promise<Uint8Array> } };

      if (!result.Body?.transformToByteArray) {
        throw new Error(`S3 object '${key}' has no body`);
      }
      return Buffer.from(await result.Body.transformToByteArray());
    },

    async delete(key: string) {
      const mod = await import("@aws-sdk/client-s3");
      const client = await getClient();
      await client.send(
        new mod.DeleteObjectCommand({
          Bucket: options.bucket,
          Key: key,
        }),
      );
    },
  };
}
