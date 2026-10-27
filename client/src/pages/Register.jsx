import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function Register() {
  const { register, showToast } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", workspaceName: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await register(form);
      showToast("Workspace created", "success");
      navigate("/");
    } catch (err) {
      setError(err.displayMessage || "Registration failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-navy-900 flex items-center justify-center p-4">
      <form onSubmit={onSubmit} className="card w-full max-w-md p-8">
        <h1 className="text-2xl font-semibold">Create your workspace</h1>
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        {["name", "email", "password", "workspaceName"].map((key) => (
          <div key={key} className="mt-4">
            <label className="label capitalize">{key === "workspaceName" ? "Workspace name" : key}</label>
            <input
              className="input"
              type={key === "password" ? "password" : key === "email" ? "email" : "text"}
              value={form[key]}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              required={key !== "workspaceName"}
            />
          </div>
        ))}
        <button className="btn-primary w-full mt-6" disabled={busy}>
          {busy ? "Creating…" : "Register"}
        </button>
        <p className="text-sm text-slate-600 mt-4">
          Already registered? <Link className="text-accent-600" to="/login">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
