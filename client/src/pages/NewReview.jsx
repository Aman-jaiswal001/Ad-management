import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api.js";
import { useAuth } from "../context/AuthContext.jsx";

const TYPES = [
  ["social_media_post", "Social media post"],
  ["advertisement", "Advertisement"],
  ["blog_post", "Blog post"],
  ["email_campaign", "Email campaign"],
  ["product_description", "Product description"],
  ["brochure_pdf", "Brochure or PDF"],
];

export default function NewReview() {
  const { workspace, showToast } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [contentType, setContentType] = useState("social_media_post");
  const [content, setContent] = useState("");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setStatus("Saving draft…");
    try {
      const form = new FormData();
      form.append("title", title);
      form.append("contentType", contentType);
      form.append("content", content);
      if (file) form.append("file", file);
      const created = await api.post("/drafts", form);
      const draftId = created.data.draft._id;
      setStatus("Running AI review (Groq, Gemini fallback). This may take a moment…");
      try {
        await api.post("/reviews", { draftId });
        showToast("Review completed", "success");
      } catch (err) {
        showToast(err.displayMessage || "AI review failed. Draft was saved.", "error");
      }
      navigate(`/drafts/${draftId}`);
    } catch (err) {
      setError(err.displayMessage || "Could not create draft");
    } finally {
      setBusy(false);
      setStatus("");
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 max-w-3xl">
      <h1 className="text-2xl font-semibold">New review</h1>
      <p className="text-sm text-slate-600">
        Workspace: <strong>{workspace?.name}</strong>. Content is sent to the configured LLM provider (Groq
        primary, Gemini fallback). The AI never publishes.
      </p>
      <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        A chat provider key must be configured in <code>server/.env</code> (<code>GROQ_API_KEY</code> or
        <code> GEMINI_API_KEY</code>). Source indexing and evidence retrieval also need Gemini embeddings and Qdrant.
      </p>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      {status && <p className="text-accent-600 text-sm">{status}</p>}
      <div>
        <label className="label">Title</label>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>
      <div>
        <label className="label">Content type</label>
        <select className="input" value={contentType} onChange={(e) => setContentType(e.target.value)}>
          {TYPES.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Draft text</label>
        <textarea className="input min-h-[220px]" value={content} onChange={(e) => setContent(e.target.value)} />
      </div>
      <div>
        <label className="label">Or upload PDF / text (extracted-text review only)</label>
        <input className="block max-w-full text-sm" type="file" accept=".pdf,.txt,.md" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        <p className="text-xs text-slate-500 mt-1">
          Logos, colors, and layout are not visually verified in this version.
        </p>
      </div>
      <button className="btn-primary" disabled={busy}>
        {busy ? "Working…" : "Save and run AI review"}
      </button>
    </form>
  );
}
