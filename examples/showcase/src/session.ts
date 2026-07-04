import type { Request, Response } from "express";
import { issueToken, type IntegrityConfig } from "@meshql/integrity";
import { db } from "./db.js";

export interface Session {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  signingToken: string;
  token: string;
}

const sessions = new Map<string, Session>();
const COOKIE = "meshql_showcase";

export const DEMO_USERS = [
  { email: "guest@example.com", label: "Guest", role: "guest" },
  { email: "ada@example.com", label: "Ada (author)", role: "author" },
  { email: "admin@example.com", label: "Admin", role: "admin" },
] as const;

export function getSession(req: Request): Session | undefined {
  const id = parseCookie(req.headers.cookie, COOKIE);
  if (!id) return undefined;
  return sessions.get(id);
}

export function loginAs(
  res: Response,
  integrity: IntegrityConfig,
  email: string,
  password = "demo",
): Session {
  const row = db
    .prepare("SELECT id, name, email, role, password FROM users WHERE email = ?")
    .get(email) as
    | { id: number; name: string; email: string; role: string; password: string }
    | undefined;

  if (!row || row.password !== password) {
    throw new Error("Invalid credentials");
  }

  const tokens = issueToken(integrity, {
    userId: String(row.id),
    sessionId: crypto.randomUUID(),
    role: row.role,
  });

  const session: Session = {
    id: crypto.randomUUID(),
    userId: String(row.id),
    name: row.name,
    email: row.email,
    role: row.role,
    signingToken: tokens.signingToken,
    token: tokens.token,
  };

  sessions.set(session.id, session);
  res.setHeader(
    "Set-Cookie",
    `${COOKIE}=${session.id}; Path=/; HttpOnly; SameSite=Lax`,
  );
  return session;
}

export function logout(req: Request, res: Response): void {
  const id = parseCookie(req.headers.cookie, COOKIE);
  if (id) sessions.delete(id);
  res.setHeader("Set-Cookie", `${COOKIE}=; Path=/; Max-Age=0`);
}

function parseCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return rest.join("=");
  }
  return undefined;
}
