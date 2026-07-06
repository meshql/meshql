/** Minimal auth identity for CRUD authorization. */
export interface AuthContext {
  userId: string;
  role: string;
}
