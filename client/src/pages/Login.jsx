import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function Login() {
  const { login, showToast } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@novapay.demo");
  const [password, setPassword] = useState("NovaPay!Admin1");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(email, password);
      showToast("Signed in", "success");
      navigate("/");
    } catch (err) {
      setError(err.displayMessage || "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-navy-900 flex items-center justify-center p-4">
      <form onSubmit={onSubmit} className="card w-full max-w-md p-8">
        <h1 className="text-2xl font-semibold">Inkloom AI</h1>
        <p className="text-sm text-slate-600 mt-1">Sign in to review brand content.</p>
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        <label className="label mt-6">Email</label>
        <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
        <label className="label mt-4">Password</label>
        <input className="input" value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
        <button className="btn-primary w-full mt-6" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <p className="text-sm text-slate-600 mt-4">
          No account? <Link className="text-accent-600" to="/register">Register</Link>
        </p>
        <p className="text-xs text-slate-500 mt-4">
          Demo (synthetic NovaPay Digital): admin@novapay.demo / NovaPay!Admin1 after running{" "}
          <code>npm run seed</code> in server.
        </p>
      </form>
    </div>
  );
}
