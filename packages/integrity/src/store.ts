import type { TokenPayload } from "./token.js";

/** Stored session record for token lifecycle management. */
export interface SessionRecord {
  payload: TokenPayload;
  signingToken: string;
  revoked: boolean;
}

/** Token store interface for session management. */
export interface TokenStore {
  save(sessionId: string, record: SessionRecord): void;
  get(sessionId: string): SessionRecord | undefined;
  revoke(sessionId: string): void;
  isRevoked(sessionId: string): boolean;
}

/** In-memory token store (single-process). */
export class InMemoryTokenStore implements TokenStore {
  private sessions = new Map<string, SessionRecord>();

  save(sessionId: string, record: SessionRecord): void {
    this.sessions.set(sessionId, record);
  }

  get(sessionId: string): SessionRecord | undefined {
    return this.sessions.get(sessionId);
  }

  revoke(sessionId: string): void {
    const record = this.sessions.get(sessionId);
    if (record) {
      record.revoked = true;
    }
  }

  isRevoked(sessionId: string): boolean {
    return this.sessions.get(sessionId)?.revoked ?? false;
  }
}
