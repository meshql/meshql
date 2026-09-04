import {
  createAuthClient,
  type AuthMeshClient,
  type MeshQuery,
} from "@meshql/client";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
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
import {
  WIRE_CAP,
  explainAuth,
  explainQuery,
  explainSse,
  explainUpload,
  explainWrite,
  formatSseFrame,
  newWireId,
} from "./wire.js";

type StartWireInit = Omit<WireEntry, "id" | "startedAt" | "status"> & {
  status?: WireEntry["status"];
};

type MeshContextValue = {
  auth: StoredAuth | null;
  wireLog: WireEntry[];
  selectedWireId: string | null;
  selectWire: (id: string | null) => void;
  clearWireLog: () => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  query: <T>(
    query: MeshQuery,
    options?: { entityId?: string },
  ) => Promise<T>;
  write: (
    op: "create" | "update" | "delete",
    entity: string,
    options?: { id?: number; data?: Record<string, unknown> },
  ) => Promise<unknown>;
  uploadAvatar: (file: File) => Promise<void>;
  subscribe: <T>(
    query: MeshQuery,
    options: { entity: string; entityId: string; onOpen?: () => void },
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
  const [selectedWireId, setSelectedWireId] = useState<string | null>(null);
  const [client, setClient] = useState<AuthMeshClient | null>(() =>
    auth ? clientFromAuth(auth) : null,
  );
  const sseByPath = useRef(new Map<string, string>());

  const selectWire = useCallback((id: string | null) => {
    setSelectedWireId(id);
  }, []);

  const clearWireLog = useCallback(() => {
    setWireLog([]);
    setSelectedWireId(null);
    sseByPath.current.clear();
  }, []);

  const startWire = useCallback((init: StartWireInit): string => {
    const id = newWireId();
    const entry: WireEntry = {
      live: false,
      eventCount: 0,
      ...init,
      id,
      startedAt: Date.now(),
      status: init.status ?? "pending",
    };
    // List only — never auto-select. Details appear when the user clicks a row.
    setWireLog((prev) => [entry, ...prev].slice(0, WIRE_CAP));
    return id;
  }, []);

  const patchWire = useCallback((id: string, patch: Partial<WireEntry>) => {
    setWireLog((prev) =>
      prev.map((entry) => {
        if (entry.id !== id) return entry;
        const next = { ...entry, ...patch };
        const finishing =
          patch.status !== undefined &&
          patch.status !== "pending" &&
          patch.durationMs === undefined &&
          entry.durationMs === undefined &&
          patch.status !== "sse";
        if (finishing) {
          next.durationMs = Date.now() - entry.startedAt;
        }
        return next;
      }),
    );
  }, []);

  const getClient = useCallback((): AuthMeshClient => {
    if (client) return client;
    const stored = loadAuth();
    if (!stored) throw new Error("Not signed in");
    const next = clientFromAuth(stored);
    setClient(next);
    return next;
  }, [client]);

  const login = useCallback(
    async (email: string, password: string) => {
      const authId = startWire({
        method: "POST",
        url: `${MESH_URL}/auth`,
        kind: "auth",
        payload: { email },
        explain: explainAuth(),
      });

      try {
        const authClient = createAuthClient({ url: MESH_URL, format: "json" });
        const tokens = await authClient.login({ email, password });
        authClient.setAuth(tokens);

        const payload = parseWireToken(tokens.token);
        patchWire(authId, {
          status: 200,
          response: { userId: payload.userId, role: payload.role },
        });

        let name = email;
        const profileQuery = {
          user: { $select: { id: true, name: true, role: true } },
        } as MeshQuery;
        const profileId = startWire({
          method: "GET",
          url: `${MESH_URL}/user/${payload.userId}`,
          kind: "query",
          payload: profileQuery,
          explain: explainQuery(profileQuery, payload.userId),
        });
        try {
          const profile = await authClient.query<UserRow>(profileQuery, {
            entityId: payload.userId,
          });
          patchWire(profileId, { status: 200, response: profile });
          if (profile?.name) name = profile.name;
        } catch {
          patchWire(profileId, {
            status: 400,
            error: "Optional profile read failed",
          });
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
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        patchWire(authId, { status: 401, error: message });
        throw error;
      }
    },
    [patchWire, startWire],
  );

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
      queryDocument: MeshQuery,
      options: { entityId?: string } = {},
    ): Promise<T> => {
      const c = getClient();
      const root = Object.keys(queryDocument)[0] ?? "unknown";
      const path = options.entityId
        ? `${MESH_URL}/${root}/${options.entityId}`
        : `${MESH_URL}/${root}`;
      const id = startWire({
        method: "GET",
        url: path,
        kind: "query",
        payload: queryDocument,
        explain: explainQuery(queryDocument, options.entityId),
      });

      try {
        const data = await c.query<T>(queryDocument, options);
        patchWire(id, { status: 200, response: data });
        return data;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        patchWire(id, { status: 400, error: message });
        throw error;
      }
    },
    [getClient, patchWire, startWire],
  );

  const write = useCallback(
    async (
      op: "create" | "update" | "delete",
      entity: string,
      options: { id?: number; data?: Record<string, unknown> } = {},
    ) => {
      const c = getClient();
      const method =
        op === "create" ? "POST" : op === "update" ? "PATCH" : "DELETE";
      const url =
        op === "create"
          ? `${MESH_URL}/${entity}`
          : `${MESH_URL}/${entity}/${options.id}`;
      const payload = op === "delete" ? {} : (options.data ?? {});
      const id = startWire({
        method,
        url,
        kind: "write",
        payload,
        explain: explainWrite(op, entity, options.id),
      });

      try {
        const data = await c.write({
          op,
          entity,
          id: options.id,
          data: options.data,
        });
        patchWire(id, {
          status: op === "create" ? 201 : 200,
          response: data,
        });
        return data;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        patchWire(id, { status: 400, error: message });
        throw error;
      }
    },
    [getClient, patchWire, startWire],
  );

  const uploadAvatar = useCallback(
    async (file: File) => {
      const c = getClient();
      const userId = auth?.userId ?? loadAuth()?.userId;
      if (!userId) throw new Error("Not signed in");
      const id = startWire({
        method: "POST",
        url: `${MESH_URL}/user/${userId}/avatar`,
        kind: "upload",
        payload: { user: { avatar: { upload: true } } },
        explain: explainUpload(),
      });

      try {
        await c.upload({
          entity: "user",
          field: "avatar",
          id: userId,
          file,
        });
        patchWire(id, { status: 200, response: { ok: true } });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        patchWire(id, { status: 400, error: message });
        throw error;
      }
    },
    [auth?.userId, getClient, patchWire, startWire],
  );

  const subscribe = useCallback(
    <T,>(
      queryDocument: MeshQuery,
      options: { entity: string; entityId: string; onOpen?: () => void },
      onUpdate: (data: T) => void,
    ) => {
      const stored = auth ?? loadAuth();
      if (!stored) {
        throw new Error("Not signed in");
      }

      const path = `${MESH_URL}/${options.entity}/${options.entityId}/events`;
      const existingId = sseByPath.current.get(path);
      let id = existingId;

      if (id) {
        // Re-open the same eventsource row — never steal inspector focus.
        patchWire(id, {
          method: "SSE",
          url: path,
          kind: "sse",
          status: "sse",
          live: false,
          payload: queryDocument,
          response: undefined,
          streamText: "",
          eventCount: 0,
          error: undefined,
          durationMs: undefined,
          explain: explainSse(options.entity, options.entityId),
        });
      } else {
        id = startWire({
          method: "SSE",
          url: path,
          kind: "sse",
          status: "sse",
          live: false,
          eventCount: 0,
          streamText: "",
          payload: queryDocument,
          explain: explainSse(options.entity, options.entityId),
        });
        sseByPath.current.set(path, id);
      }

      const wireId = id;

      const unsubscribe = subscribeMeshEvents(queryDocument, {
        entity: options.entity,
        entityId: options.entityId,
        auth: stored,
        onInitialize: (data) => {
          setWireLog((prev) =>
            prev.map((entry) =>
              entry.id === wireId
                ? {
                    ...entry,
                    streamText: `${entry.streamText ?? ""}${formatSseFrame(data, "initialize")}`,
                    error: undefined,
                    live: true,
                  }
                : entry,
            ),
          );
          options.onOpen?.();
        },
        onUpdate: (data) => {
          setWireLog((prev) =>
            prev.map((entry) =>
              entry.id === wireId
                ? {
                    ...entry,
                    response: data,
                    streamText: `${entry.streamText ?? ""}${formatSseFrame(data, "update")}`,
                    eventCount: (entry.eventCount ?? 0) + 1,
                    error: undefined,
                    live: true,
                  }
                : entry,
            ),
          );
          onUpdate(data as T);
        },
        onError: (message) => {
          patchWire(wireId, { error: message, live: false });
        },
      });

      return () => {
        // Keep the wire row; mark the stream closed. Re-subscribe to the same
        // path reuses this row instead of looking like another GET.
        setWireLog((prev) =>
          prev.map((entry) =>
            entry.id === wireId
              ? {
                  ...entry,
                  live: false,
                  durationMs: Date.now() - entry.startedAt,
                }
              : entry,
          ),
        );
        unsubscribe();
      };
    },
    [auth, patchWire, startWire],
  );

  const value = useMemo(
    () => ({
      auth,
      wireLog,
      selectedWireId,
      selectWire,
      clearWireLog,
      login,
      logout,
      query,
      write,
      uploadAvatar,
      subscribe,
    }),
    [
      auth,
      wireLog,
      selectedWireId,
      selectWire,
      clearWireLog,
      login,
      logout,
      query,
      write,
      uploadAvatar,
      subscribe,
    ],
  );

  return <MeshContext.Provider value={value}>{children}</MeshContext.Provider>;
}

export function useMesh(): MeshContextValue {
  const ctx = useContext(MeshContext);
  if (!ctx) throw new Error("useMesh must be used within MeshProvider");
  return ctx;
}
