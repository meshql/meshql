import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMesh } from "./MeshContext.js";

const DEMO_ACCOUNTS = [
  { email: "guest@example.com", label: "read published posts" },
  { email: "ada@example.com", label: "author CRUD" },
  { email: "admin@example.com", label: "full access" },
] as const;

export function LoginPage() {
  const { login } = useMesh();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("demo");
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setLoading(true);

    try {
      await login(email.trim(), password);
      navigate("/dashboard");
    } catch {
      setError("Invalid email or password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h1>MeshQL Blog</h1>
        <p className="subtitle">
          Sign in via <code>POST /mesh/auth</code> using <code>@meshql/client</code>.
          Watch the network sheet at the bottom of the page.
        </p>
        <p className="demo-note">
          Shared live demo at{" "}
          <a href="https://showcase.meshql.dev">showcase.meshql.dev</a> — posts are
          not private.{" "}
          <a href="/docs">Playground</a>
          {" · "}
          <a href="https://docs.meshql.dev" target="_blank" rel="noopener noreferrer">
            Docs
          </a>
        </p>
        {error ? <div className="flash err">{error}</div> : null}
        <form className="auth-form" onSubmit={onSubmit}>
          <label>
            Email
            <input
              type="email"
              name="email"
              required
              autoFocus
              placeholder="ada@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              name="password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <button type="submit" className="btn primary full" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <div className="demo-accounts">
          <p>
            Demo accounts (password: <code>demo</code>) — click to fill
          </p>
          <div className="demo-chips">
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.email}
                type="button"
                className="demo-chip"
                onClick={() => {
                  setEmail(account.email);
                  setPassword("demo");
                }}
              >
                <strong>{account.email}</strong>
                <span>{account.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
