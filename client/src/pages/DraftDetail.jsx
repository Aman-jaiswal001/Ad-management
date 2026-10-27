import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../services/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import Spinner from "../components/Spinner.jsx";
import ConfirmDialog from "../components/ConfirmDialog.jsx";

const SEVERITIES = ["Low", "Medium", "High", "Critical"];

export default function DraftDetail() {
  const { id } = useParams();
  const { role, showToast } = useAuth();
  const [draft, setDraft] = useState(null);
  const [comments, setComments] = useState([]);
  const [findings, setFindings] = useState([]);
  const [revisions, setRevisions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [severity, setSeverity] = useState("");
  const [category, setCategory] = useState("");
  const [content, setContent] = useState("");
  const [comment, setComment] = useState("");
  const [reason, setReason] = useState("");
  const [dismissing, setDismissing] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [tab, setTab] = useState("review");

  async function load() {
    const [d, f, r] = await Promise.all([
      api.get(`/drafts/${id}`),
      api.get(`/drafts/${id}/findings`),
      api.get(`/drafts/${id}/revisions`),
    ]);
    setDraft(d.data.draft);
    setComments(d.data.comments || []);
    setContent(d.data.draft.currentContent);
    setFindings(f.data.items || []);
    setRevisions(r.data.items || []);
  }

  useEffect(() => {
    load().catch((err) => setError(err.displayMessage));
  }, [id]);

  const filtered = useMemo(
    () =>
      findings.filter(
        (f) => (!severity || f.severity === severity) && (!category || f.category === category)
      ),
    [findings, severity, category]
  );

  async function saveContent() {
    setBusy("save");
    try {
      await api.put(`/drafts/${id}`, { content, note: "Editor save" });
      showToast("Revision saved", "success");
      await load();
    } catch (err) {
      showToast(err.displayMessage, "error");
    } finally {
      setBusy("");
    }
  }

  async function runReview() {
    setBusy("review");
    try {
      await api.post("/reviews", { draftId: id });
      showToast("Review finished", "success");
      await load();
    } catch (err) {
      showToast(err.response?.data?.error || err.displayMessage, "error");
      await load();
    } finally {
      setBusy("");
    }
  }

  async function act(finding, status, extra = {}) {
    try {
      await api.patch(`/findings/${finding._id}`, { status, ...extra });
      showToast(`Finding ${status.toLowerCase()}`, "success");
      await load();
    } catch (err) {
      showToast(err.displayMessage, "error");
    }
  }

  async function workflow(path, body) {
    try {
      await api.post(`/drafts/${id}/${path}`, body);
      showToast("Updated", "success");
      await load();
    } catch (err) {
      showToast(err.displayMessage, "error");
    }
  }

  if (error) return <p className="text-red-600">{error}</p>;
  if (!draft) return <Spinner />;

  const highlight = selected?.matchedText;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{draft.title}</h1>
          <p className="text-sm text-slate-600">
            {draft.status} · {draft.contentType} · revision {draft.currentRevision}
            {draft.latestReviewRun?.providerUsed && (
              <>
                {" "}
                · provider {draft.latestReviewRun.providerUsed}
                {draft.latestReviewRun.fallbackUsed ? " (fallback)" : ""}
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" onClick={() => setTab("review")}>
            Review
          </button>
          <button className="btn-secondary" onClick={() => setTab("history")}>
            History
          </button>
          <button className="btn-primary" disabled={busy === "review"} onClick={runReview}>
            {busy === "review" ? "Reviewing…" : "Run / rerun AI review"}
          </button>
        </div>
      </div>

      {draft.latestReviewRun?.errorMessage && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
          {draft.latestReviewRun.errorMessage}
        </p>
      )}

      {tab === "history" ? (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="card p-4">
            <h2 className="font-semibold mb-2">Original</h2>
            <pre className="whitespace-pre-wrap text-sm">{draft.originalContent}</pre>
          </div>
          <div className="card p-4 space-y-3">
            <h2 className="font-semibold">Revisions</h2>
            {revisions.map((r) => (
              <div key={r._id} className="border-b border-slate-100 pb-3">
                <p className="text-sm font-medium">
                  r{r.revisionNumber} · {r.note}
                </p>
                <pre className="whitespace-pre-wrap text-xs text-slate-600 mt-1">{r.content}</pre>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="card p-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span>Current revision</span>
              <button className="btn-secondary" disabled={busy === "save"} onClick={saveContent}>
                Save revision
              </button>
            </div>
            <textarea
              className="input min-h-[420px] font-mono text-sm"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
            {highlight && content.includes(highlight) && (
              <p className="text-xs text-slate-500">
                Selected match: <span className="bg-amber-200">{highlight}</span>
              </p>
            )}
            <p className="text-xs text-slate-500">Original content is preserved and never overwritten.</p>
          </div>
          <div className="space-y-3">
            <div className="card p-4">
              <div className="flex justify-between">
                <p className="font-semibold">{filtered.length} findings</p>
                <p className="text-xs text-slate-500">{findings.filter((f) => f.requiresHumanReview).length} need human review</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
                <select className="input" value={severity} onChange={(e) => setSeverity(e.target.value)}>
                  <option value="">All severities</option>
                  {SEVERITIES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
                <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="">All categories</option>
                  {[...new Set(findings.map((f) => f.category))].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-3 max-h-[640px] overflow-y-auto">
              {filtered.map((f) => (
                <article
                  key={f._id}
                  className={`card p-4 cursor-pointer ${selected?._id === f._id ? "ring-2 ring-accent-500" : ""}`}
                  onClick={() => setSelected(f)}
                >
                  <div className="flex justify-between gap-2">
                    <h3 className="font-medium">{f.title}</h3>
                    <span className="text-xs">{f.severity}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {f.publicId} · {f.category} · {f.issueKind} · {f.status} · confidence{" "}
                    {Math.round((f.confidence || 0) * 100)}%
                  </p>
                  {f.matchedText && (
                    <p className="text-sm bg-amber-50 mt-2 p-2 rounded">“{f.matchedText}”</p>
                  )}
                  <p className="text-sm mt-2">{f.explanation}</p>
                  {f.suggestedCorrection && (
                    <p className="text-sm mt-2 text-emerald-800">Suggestion: {f.suggestedCorrection}</p>
                  )}
                  {(f.sourceReferences || []).map((s, i) => (
                    <p key={i} className="text-xs text-slate-500 mt-1">
                      Source {s.sourceName} v{s.sourceVersion} {s.section} page {s.pageNumber || "n/a"}
                    </p>
                  ))}
                  {f.requiresHumanReview && (
                    <p className="text-xs text-red-700 mt-2">Human review required before approval.</p>
                  )}
                  <div className="flex flex-wrap gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
                    <button className="btn-secondary" onClick={() => act(f, "Accepted")}>
                      Accept
                    </button>
                    <button
                      className="btn-secondary"
                      onClick={() => {
                        const edited = window.prompt("Edited suggestion", f.suggestedCorrection || "");
                        if (edited != null) act(f, "Edited", { editedSuggestion: edited });
                      }}
                    >
                      Edit
                    </button>
                    <button className="btn-secondary" onClick={() => setDismissing(f)}>
                      Dismiss
                    </button>
                    <button className="btn-secondary" onClick={() => api.post(`/findings/${f._id}/escalate`).then(load)}>
                      Escalate
                    </button>
                    <button className="btn-secondary" onClick={() => act(f, "Resolved")}>
                      Resolve
                    </button>
                  </div>
                </article>
              ))}
              {!filtered.length && <p className="text-sm text-slate-500">No findings for this filter.</p>}
            </div>
          </div>
        </div>
      )}

      <div className="card p-4 space-y-3">
        <h2 className="font-semibold">Workflow</h2>
        <div className="flex flex-wrap gap-2">
          {["CREATOR", "ADMIN"].includes(role) && (
            <button className="btn-primary" onClick={() => workflow("submit")}>
              Submit / resubmit for approval
            </button>
          )}
          {["MANAGER", "ADMIN"].includes(role) && (
            <button
              className="btn-secondary"
              onClick={() => {
                const r = window.prompt("Change request reason");
                if (r) workflow("request-changes", { reason: r });
              }}
            >
              Request changes
            </button>
          )}
          {["REVIEWER", "ADMIN"].includes(role) && (
            <>
              <button className="btn-primary" onClick={() => workflow("approve", { reason: "Approved" })}>
                Approve
              </button>
              <button
                className="btn-danger"
                onClick={() => {
                  const r = window.prompt("Rejection reason");
                  if (r) workflow("reject", { reason: r });
                }}
              >
                Reject
              </button>
            </>
          )}
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await api.post(`/drafts/${id}/comments`, { body: comment });
            setComment("");
            await load();
          }}
          className="flex flex-col sm:flex-row gap-2"
        >
          <input className="input" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add a comment" />
          <button className="btn-secondary">Comment</button>
        </form>
        {comments.map((c) => (
          <p key={c._id} className="text-sm">
            <strong>{c.author?.name}:</strong> {c.body}
          </p>
        ))}
      </div>

      <ConfirmDialog
        open={Boolean(dismissing)}
        title="Dismiss finding"
        body="Provide a reason. This is stored on the finding and in audit logs."
        confirmLabel="Dismiss"
        onClose={() => setDismissing(null)}
        onConfirm={async () => {
          if (!reason) {
            showToast("Reason required", "error");
            return;
          }
          await act(dismissing, "Dismissed", { reason });
          setDismissing(null);
          setReason("");
        }}
      />
      {dismissing && (
        <div className="fixed bottom-4 left-4 right-4 z-50 card p-3 sm:left-auto sm:right-6 sm:w-80">
          <label className="label">Dismissal reason</label>
          <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
      )}
    </div>
  );
}
