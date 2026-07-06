export type PostRow = {
  id: number;
  title?: string;
  body?: string;
  status?: string;
  author?: { name?: string };
  comments?: Array<{ id?: number; body?: string; author?: { name?: string } }>;
};

export type UserRow = {
  id: number;
  name?: string;
  email?: string;
  role?: string;
  avatar?: string;
};

export type StoredAuth = {
  signingToken: string;
  token: string;
  expiresAt: number;
  userId: string;
  role: string;
  name: string;
};

export type WireEntry = {
  method: string;
  url: string;
  payload?: unknown;
  response?: unknown;
  error?: string;
};
