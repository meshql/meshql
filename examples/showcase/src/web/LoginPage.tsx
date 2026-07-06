import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMesh } from "./MeshContext.js";

export function LoginPage() {
  const { login } = useMesh();
  const navigate = useNavigate();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setLoading(true);
    const form = event.currentTarget;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value.trim();
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;

    try {
      await login(email, password);
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
          Sign in via <code>POST /mesh/auth</code> using <code>@meshql/client</code>
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
            />
          </label>
          <label>
            Password
            <input type="password" name="password" required defaultValue="demo" />
          </label>
          <button type="submit" className="btn primary full" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <div className="demo-accounts">
          <p>
            Demo accounts (password: <code>demo</code>)
          </p>
          <ul>
            <li>
              <strong>guest@example.com</strong> — read published posts
            </li>
            <li>
              <strong>ada@example.com</strong> — author CRUD
            </li>
            <li>
              <strong>admin@example.com</strong> — full access
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
