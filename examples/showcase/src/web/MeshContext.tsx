import {
  createAuthClient,
  type AuthMeshClient,
  type QueryControls,
  type QuerySelection,
} from "@meshql/client";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { StoredAuth, UserRow, WireEntry } from "./types.js";
import { subscribeMeshEvents } from "./subscribe.js";
import {
  clearAuth,
  loadAuth,
  MESH_URL,
  parseWireToken,
  saveAuth,
} from "./utils.js";

type MeshContextValue = {
  auth: StoredAuth | null;
  wireLog: WireEntry[];
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  query: <T>(
    selection: QuerySelection,
    options?: { entityId?: string } & QueryControls,
  ) => Promise<T>;
  write: (
    op: "create" | "update" | "delete",
    entity: string,
    options?: { id?: number; data?: Record<string, unknown> },
  ) => Promise<unknown>;
  uploadAvatar: (file: File) => Promise<void>;
  subscribe: <T>(
    selection: QuerySelection,
    options: { entity: string; entityId: string },
    onUpdate: (data: T) => void,
  ) => () => void;
};

const MeshContext = createContext<MeshContextValue | null>(null);

function clientFromAuth(auth: StoredAuth): AuthMeshClient {
  const client = createAuthClient({ url: MESH_URL, format: "json" });
  client.setAuth({ signingToken: auth.signingToken, token: auth.token });
  return client;
}

export function MeshProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<StoredAuth | null>(() => loadAuth());
  const [wireLog, setWireLog] = useState<WireEntry[]>([]);
  const [client, setClient] = useState<AuthMeshClient | null>(() =>
    auth ? clientFromAuth(auth) : null,
  );

  const logWire = useCallback((entry: WireEntry) => {
    setWireLog((prev) => [entry, ...prev].slice(0, 8));
  }, []);

  const getClient = useCallback((): AuthMeshClient => {
    if (client) return client;
    const stored = loadAuth();
    if (!stored) throw new Error("Not signed in");
    const next = clientFromAuth(stored);
    setClient(next);
    return next;
  }, [client]);

  const login = useCallback(async (email: string, password: string) => {
    const authClient = createAuthClient({ url: MESH_URL, format: "json" });
    const tokens = await authClient.login({ email, password });
    authClient.setAuth(tokens);

    const payload = parseWireToken(tokens.token);
    let name = email;
    try {
      const profile = await authClient.query<UserRow>(
        { user: { id: true, name: true, role: true } },
        { entityId: payload.userId },
      );
      if (profile?.name) name = profile.name;
    } catch {
      // optional at login
    }

    const stored: StoredAuth = {
      signingToken: tokens.signingToken,
      token: tokens.token,
      expiresAt: tokens.expiresAt,
      userId: payload.userId,
      role: payload.role ?? "guest",
      name,
    };

    saveAuth(stored);
    setAuth(stored);
    setClient(authClient);
    logWire({
      method: "POST",
      url: `${MESH_URL}/auth`,
      payload: { email },
      response: { userId: payload.userId, role: payload.role },
    });
  }, [logWire]);

  const logout = useCallback(async () => {
    const token = auth?.token ?? loadAuth()?.token;
    if (token) {
      try {
        await fetch(`${MESH_URL}/logout`, {
          method: "POST",
          headers: { "X-Mesh-Token": token },
        });
      } catch {
        // ignore
      }
    }
    clearAuth();
    setAuth(null);
    setClient(null);
  }, [auth?.token]);

  const query = useCallback(
    async <T,>(
      selection: QuerySelection,
      options: { entityId?: string } & QueryControls = {},
    ): Promise<T> => {
      const c = getClient();
      const root = Object.keys(selection)[0] ?? "unknown";
      const path = options.entityId
        ? `${MESH_URL}/${root}/${options.entityId}`
        : `${MESH_URL}/${root}`;

      try {
        const data = await c.query<T>(selection, options);
        logWire({ method: "GET", url: path, payload: { selection, options }, response: data });
        return data;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logWire({ method: "GET", url: path, payload: { selection, options }, error: message });
        throw error;
      }
    },
    [getClient, logWire],
  );

  const write = useCallback(
    async (
      op: "create" | "update" | "delete",
      entity: string,
      options: { id?: number; data?: Record<string, unknown> } = {},
    ) => {
      const c = getClient();
      const payload = { $write: { op, entity, id: options.id, data: options.data } };

      try {
        const data = await c.write({
          op,
          entity,
          id: options.id,
          data: options.data,
        });
        logWire({ method: "POST", url: `${MESH_URL}/write`, payload, response: data });
        return data;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logWire({ method: "POST", url: `${MESH_URL}/write`, payload, error: message });
        throw error;
      }
    },
    [getClient, logWire],
  );

  const uploadAvatar = useCallback(
    async (file: File) => {
      const c = getClient();
      const userId = auth?.userId ?? loadAuth()?.userId;
      if (!userId) throw new Error("Not signed in");

      await c.upload({
        entity: "user",
        field: "avatar",
        id: userId,
        file,
      });
      logWire({
        method: "POST",
        url: `${MESH_URL}/user/${userId}/avatar`,
        payload: { user: { avatar: { upload: true } } },
        response: { ok: true },
      });
    },
    [auth?.userId, getClient, logWire],
  );

  const subscribe = useCallback(
    <T,>(
      selection: QuerySelection,
      options: { entity: string; entityId: string },
      onUpdate: (data: T) => void,
    ) => {
      const stored = auth ?? loadAuth();
      if (!stored) {
        throw new Error("Not signed in");
      }

      const path = `${MESH_URL}/${options.entity}/${options.entityId}/events`;
      logWire({
        method: "SSE",
        url: path,
        payload: selection,
        response: { subscribed: true },
      });

      return subscribeMeshEvents(selection, {
        entity: options.entity,
        entityId: options.entityId,
        auth: stored,
        onUpdate: (data) => {
          logWire({ method: "SSE", url: path, payload: selection, response: data });
          onUpdate(data as T);
        },
        onError: (message) => {
          logWire({ method: "SSE", url: path, payload: selection, error: message });
        },
      });
    },
    [auth, logWire],
  );

  const value = useMemo(
    () => ({ auth, wireLog, login, logout, query, write, uploadAvatar, subscribe }),
    [auth, wireLog, login, logout, query, write, uploadAvatar, subscribe],
  );

  return <MeshContext.Provider value={value}>{children}</MeshContext.Provider>;
}

export function useMesh(): MeshContextValue {
  const ctx = useContext(MeshContext);
  if (!ctx) throw new Error("useMesh must be used within MeshProvider");
  return ctx;
}
