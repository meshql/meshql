export interface User {
  id: number;
  name: string;
  avatar?: string;
}

export interface Token {
  accessToken: string;
  expiresAt: string;
}
