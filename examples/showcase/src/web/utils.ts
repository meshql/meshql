import type { StoredAuth } from "./types.js";

export const MESH_URL = "/mesh";
export const AUTH_KEY = "meshql_showcase_auth";

export function parseWireToken(token: string): { userId: string; role?: string } {
  if (!token.startsWith("tok_")) throw new Error("Invalid token");
  const encoded = token.slice(4);
  const padded = encoded + "=".repeat((4 - (encoded.length % 4)) % 4);
  const base64 = padded.replace(/-/g, "+").replace(/_/g, "/");
  const json = atob(base64);
  return JSON.parse(json) as { userId: string; role?: string };
}

export function loadAuth(): StoredAuth | null {
  const raw = sessionStorage.getItem(AUTH_KEY);
  if (!raw) return null;
  try {
    const auth = JSON.parse(raw) as StoredAuth;
    if (auth.expiresAt <= Date.now()) {
      sessionStorage.removeItem(AUTH_KEY);
      return null;
    }
    return auth;
  } catch {
    return null;
  }
}

export function saveAuth(auth: StoredAuth): void {
  sessionStorage.setItem(AUTH_KEY, JSON.stringify(auth));
}

export function clearAuth(): void {
  sessionStorage.removeItem(AUTH_KEY);
}

export function canWritePosts(role: string): boolean {
  return role === "author" || role === "admin";
}

export function canWriteComments(role: string): boolean {
  return role === "author" || role === "admin";
}
