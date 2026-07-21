import { queryToQl } from "./query-builder.js";
import { queryToJson, type MeshQuery } from "./read-query.js";
import { signPersistedQuery, signQuery } from "./sign.js";

/** Auth credentials returned from login. */
export interface AuthTokens {
  signingToken: string;
  token: string;
  expiresAt: number;
}

/** Persisted query transport options. */
export type PersistedQueriesOption =
  | boolean
  | {
      /** Register unknown queries on first use. Defaults to true. */
      autoRegister?: boolean;
      /** Client-side cache of raw query → persisted ID. */
      cache?: Map<string, string>;
    };

/** Options for {@link createClient}. */
export interface MeshClientOptions {
  url: string;
  format?: "json" | "ql";
  fetch?: typeof fetch;
  headers?: Record<string, string>;
  /** Basic HMAC mode — signs with shared secret. */
  secret?: string;
  /** Full integrity mode — signs with derived signing token. */
  signingToken?: string;
  /** Wire token from POST /mesh/auth. */
  token?: string;
  /** Called when token expires for silent re-auth. */
  onTokenExpired?: () => Promise<AuthTokens>;
  /**
   * Send `X-Mesh-Query-Id` instead of the full `X-Mesh-Query` header.
   * When enabled, unknown queries are registered via `POST /{base}/queries`
   * on first use unless a cached ID already exists.
   */
  persistedQueries?: PersistedQueriesOption;
}

/** Signed write operation (showcase / preview until core mutations). */
export interface WritePayload {
  op: "create" | "update" | "delete";
  entity: string;
  id?: number | string;
  data?: Record<string, unknown>;
}

/** Options for {@link MeshClient.write}. */
export interface WriteOptions {
  op: WritePayload["op"];
  entity: string;
  id?: number | string;
  data?: Record<string, unknown>;
}

/** File input for {@link MeshClient.upload}. */
export type UploadFileInput =
  | Blob
  | ArrayBuffer
  | Uint8Array
  | { buffer: ArrayBuffer | Uint8Array; filename?: string; mimetype?: string };

/** Options for {@link MeshClient.upload}. */
export interface UploadOptions {
  entity: string;
  field: string;
  /** Attach to an existing record; omit to create. */
  id?: string;
  file: UploadFileInput;
  /** Optional JSON metadata sent as a multipart `meta` part. */
  meta?: Record<string, unknown>;
}

/** Typed MeshQL HTTP client. */
export interface MeshClient {
  /** Execute a canonical MeshQL query; options contain transport metadata only. */
  query<T = Record<string, unknown>>(
    query: MeshQuery,
    options?: { entityId?: string },
  ): Promise<T>;
  /**
   * Upload a file to an entity field.
   *
   * Hashes the file, signs a payload including `contentHash`, and POSTs
   * `multipart/form-data` to `/:entity/:id/:field` (or `/:entity` when `id`
   * is omitted).
   */
  upload<T = Record<string, unknown>>(options: UploadOptions): Promise<T>;
  /**
   * Execute a signed write against `POST /write` (preview API).
   *
   * Payload is transported in the signed `X-Mesh-Query` header as
   * `{ $write: { op, entity, id?, data? } }`.
   */
  write<T = Record<string, unknown>>(options: WriteOptions): Promise<T>;
  /** Update signing credentials after login or refresh. */
  setAuth(tokens: Partial<Pick<AuthTokens, "signingToken" | "token">>): void;
}

/** Create a MeshQL HTTP client. */
export function createClient(options: MeshClientOptions): MeshClient {
  const fetchFn = options.fetch ?? globalThis.fetch.bind(globalThis);
  const format = options.format ?? "json";

  const auth = {
    secret: options.secret,
    signingToken: options.signingToken,
    token: options.token,
    onTokenExpired: options.onTokenExpired,
  };

  const persistedConfig =
    options.persistedQueries === true
      ? { autoRegister: true, cache: new Map<string, string>() }
      : options.persistedQueries
        ? {
            autoRegister: options.persistedQueries.autoRegister ?? true,
            cache: options.persistedQueries.cache ?? new Map<string, string>(),
          }
        : undefined;

  async function resolveSignedHeaders(raw: string): Promise<Record<string, string>> {
    const signOptions = {
      format,
      secret: auth.secret,
      signingToken: auth.signingToken,
      token: auth.token,
    };

    if (!persistedConfig) {
      return signQuery(raw, signOptions);
    }

    const cacheKey = `${format}\0${raw}`;
    let queryId = persistedConfig.cache.get(cacheKey);

    if (!queryId && persistedConfig.autoRegister) {
      const response = await fetchFn(`${options.url}/queries`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
        body: JSON.stringify({ query: raw, format }),
      });

      if (!response.ok) {
        const errorBody = (await response.json().catch(() => ({}))) as {
          message?: string;
        };
        throw new Error(
          errorBody.message ??
            `MeshQL query registration failed (${response.status})`,
        );
      }

      const body = (await response.json()) as { id: string };
      queryId = body.id;
      persistedConfig.cache.set(cacheKey, queryId);
    }

    if (!queryId) {
      throw new Error(
        "Persisted query ID not found — enable autoRegister or pre-register queries",
      );
    }

    return signPersistedQuery(queryId, signOptions);
  }

  async function executeQuery<T>(
    query: MeshQuery,
    requestOptions: { entityId?: string } = {},
  ): Promise<T> {
    const roots = Object.keys(query);
    if (roots.length !== 1) {
      throw new Error("MeshQL query must have exactly one root entity");
    }
    const rootEntity = roots[0]!;
    const rootNode = query[rootEntity]!;

    if (
      requestOptions.entityId &&
      Object.keys(rootNode).some((key) => key !== "$select")
    ) {
      throw new Error(
        "Cannot combine root read controls with `entityId`",
      );
    }

    const raw = format === "json" ? queryToJson(query) : queryToQl(query);

    const path = requestOptions.entityId
      ? `${options.url}/${rootEntity}/${requestOptions.entityId}`
      : `${options.url}/${rootEntity}`;

    const signedHeaders = await resolveSignedHeaders(raw);

    const response = await fetchFn(path, {
      method: "GET",
      headers: {
        ...options.headers,
        ...signedHeaders,
      },
    });

    if (response.status === 401 && auth.onTokenExpired) {
      const refreshed = await auth.onTokenExpired();
      auth.signingToken = refreshed.signingToken;
      auth.token = refreshed.token;
      return executeQuery(query, requestOptions);
    }

    if (!response.ok) {
      const errorBody = (await response.json().catch(() => ({}))) as {
        message?: string;
      };
      throw new Error(
        errorBody.message ?? `MeshQL request failed (${response.status})`,
      );
    }

    return (await response.json()) as T;
  }

  async function executeUpload<T>(uploadOptions: UploadOptions): Promise<T> {
    const { buffer, filename, mimetype } = await normalizeUploadFile(uploadOptions.file);
    const contentHash = await hashBuffer(buffer);
    const raw = JSON.stringify({
      [uploadOptions.entity]: {
        [uploadOptions.field]: { upload: true },
      },
      contentHash,
    });

    const path = uploadOptions.id
      ? `${options.url}/${uploadOptions.entity}/${uploadOptions.id}/${uploadOptions.field}`
      : `${options.url}/${uploadOptions.entity}`;

    const signedHeaders = await resolveSignedHeaders(raw);

    const form = new FormData();
    const bytes = new Uint8Array(buffer.byteLength);
    bytes.set(buffer);
    form.append("file", new Blob([bytes], { type: mimetype }), filename);
    if (uploadOptions.meta) {
      form.append("meta", JSON.stringify(uploadOptions.meta));
    }

    const response = await fetchFn(path, {
      method: "POST",
      headers: {
        ...options.headers,
        ...signedHeaders,
      },
      body: form,
    });

    if (response.status === 401 && auth.onTokenExpired) {
      const refreshed = await auth.onTokenExpired();
      auth.signingToken = refreshed.signingToken;
      auth.token = refreshed.token;
      return executeUpload(uploadOptions);
    }

    if (!response.ok) {
      const errorBody = (await response.json().catch(() => ({}))) as {
        message?: string;
      };
      throw new Error(
        errorBody.message ?? `MeshQL upload failed (${response.status})`,
      );
    }

    return (await response.json()) as T;
  }

  async function executeWrite<T>(writeOptions: WriteOptions): Promise<T> {
    const payload: WritePayload = {
      op: writeOptions.op,
      entity: writeOptions.entity,
      id: writeOptions.id,
      data: writeOptions.data,
    };
    const raw = JSON.stringify({ $write: payload });

    const signedHeaders = await resolveSignedHeaders(raw);

    const response = await fetchFn(`${options.url}/write`, {
      method: "POST",
      headers: {
        ...options.headers,
        ...signedHeaders,
      },
    });

    if (response.status === 401 && auth.onTokenExpired) {
      const refreshed = await auth.onTokenExpired();
      auth.signingToken = refreshed.signingToken;
      auth.token = refreshed.token;
      return executeWrite(writeOptions);
    }

    if (!response.ok) {
      const errorBody = (await response.json().catch(() => ({}))) as {
        message?: string;
      };
      throw new Error(
        errorBody.message ?? `MeshQL write failed (${response.status})`,
      );
    }

    return (await response.json()) as T;
  }

  return {
    query: executeQuery,
    upload: executeUpload,
    write: executeWrite,
    setAuth(tokens) {
      if (tokens.signingToken !== undefined) {
        auth.signingToken = tokens.signingToken;
      }
      if (tokens.token !== undefined) {
        auth.token = tokens.token;
      }
    },
  };
}

async function hashBuffer(buffer: Uint8Array): Promise<string> {
  const bytes = new Uint8Array(buffer.byteLength);
  bytes.set(buffer);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return `sha256:${bufferToHex(new Uint8Array(digest))}`;
}

function bufferToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function normalizeUploadFile(file: UploadFileInput): Promise<{
  buffer: Uint8Array;
  filename: string;
  mimetype: string;
}> {
  if (typeof Blob !== "undefined" && file instanceof Blob) {
    const buffer = new Uint8Array(await file.arrayBuffer());
    return {
      buffer,
      filename: "name" in file && typeof file.name === "string" ? file.name : "upload",
      mimetype: file.type || "application/octet-stream",
    };
  }

  if (file instanceof ArrayBuffer) {
    return {
      buffer: new Uint8Array(file),
      filename: "upload",
      mimetype: "application/octet-stream",
    };
  }

  if (file instanceof Uint8Array) {
    return {
      buffer: file,
      filename: "upload",
      mimetype: "application/octet-stream",
    };
  }

  if (file && typeof file === "object" && "buffer" in file) {
    const buffer =
      file.buffer instanceof ArrayBuffer
        ? new Uint8Array(file.buffer)
        : file.buffer;
    return {
      buffer,
      filename: file.filename ?? "upload",
      mimetype: file.mimetype ?? "application/octet-stream",
    };
  }

  throw new Error("Unsupported upload file type");
}

/** Options for {@link createAuthClient}. */
export interface AuthClientOptions {
  url: string;
  format?: "json" | "ql";
  fetch?: typeof fetch;
  headers?: Record<string, string>;
}

/** Auth-enabled MeshQL client with login support. */
export interface AuthMeshClient extends MeshClient {
  login(credentials: unknown): Promise<AuthTokens>;
}

/** Create a MeshQL client with built-in auth flow. */
export function createAuthClient(options: AuthClientOptions): AuthMeshClient {
  const fetchFn = options.fetch ?? globalThis.fetch.bind(globalThis);
  const tokens: { current?: AuthTokens } = {};

  const client = createClient({
    ...options,
    onTokenExpired: async () => {
      if (!tokens.current) {
        throw new Error("Token expired — call login() to re-authenticate");
      }
      throw new Error("Token expired — call login() to re-authenticate");
    },
  });

  async function login(credentials: unknown): Promise<AuthTokens> {
    const response = await fetchFn(`${options.url}/auth`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      const errorBody = (await response.json().catch(() => ({}))) as {
        message?: string;
      };
      throw new Error(errorBody.message ?? `Auth failed (${response.status})`);
    }

    const result = (await response.json()) as AuthTokens;
    tokens.current = result;
    client.setAuth({ signingToken: result.signingToken, token: result.token });
    return result;
  }

  return Object.assign(client, { login });
}

export { queryToQl } from "./query-builder.js";
export { queryToJson } from "./read-query.js";
export type { MeshQuery, ReadNode, ReadSelection } from "./read-query.js";
