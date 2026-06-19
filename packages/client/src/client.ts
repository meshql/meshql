import { signQuery } from "@meshql/http";
import {
  selectionToJson,
  selectionToQl,
  type QuerySelection,
} from "./query-builder.js";

/** Auth credentials returned from login. */
export interface AuthTokens {
  signingToken: string;
  token: string;
  expiresAt: number;
}

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
}

/** Typed MeshQL HTTP client. */
export interface MeshClient {
  /** Execute a field selection query against the MeshQL server. */
  query<T = Record<string, unknown>>(
    selection: QuerySelection,
    options?: { entityId?: string },
  ): Promise<T>;
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

  async function executeQuery<T>(
    selection: QuerySelection,
    requestOptions: { entityId?: string } = {},
  ): Promise<T> {
    const rootEntity = Object.keys(selection)[0];
    if (!rootEntity) {
      throw new Error("Query selection must include a root entity");
    }

    const raw =
      format === "json"
        ? selectionToJson(selection)
        : selectionToQl(selection);

    const path = requestOptions.entityId
      ? `${options.url}/${rootEntity}/${requestOptions.entityId}`
      : `${options.url}/${rootEntity}`;

    const signedHeaders = signQuery(raw, {
      format,
      secret: auth.secret,
      signingToken: auth.signingToken,
      token: auth.token,
    });

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
      return executeQuery(selection, requestOptions);
    }

    if (!response.ok) {
      const errorBody = (await response.json().catch(() => ({}))) as {
        message?: string;
      };
      throw new Error(errorBody.message ?? `MeshQL request failed (${response.status})`);
    }

    return (await response.json()) as T;
  }

  return {
    query: executeQuery,
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

export { selectionToJson, selectionToQl } from "./query-builder.js";
export type { QuerySelection } from "./query-builder.js";
