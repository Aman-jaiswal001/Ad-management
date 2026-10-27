import { useEffect, useState } from "react";
import api from "../services/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import Spinner from "../components/Spinner.jsx";

export default function Settings() {
  const { workspaceId, workspace, reload, showToast } = useAuth();
  const [ws, setWs] = useState(null);
  const [members, setMembers] = useState([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("CREATOR");
  const [voice, setVoice] = useState({ preferredTone: "", writingPrinciples: "", wordsToAvoid: "", examples: "" });

  async function load() {
    const [w, m] = await Promise.all([
      api.get(`/workspaces/${workspaceId}`),
      api.get(`/workspaces/${workspaceId}/members`),
    ]);
    setWs(w.data.workspace);
    setMembers(m.data.items);
    const bv = w.data.workspace.brandVoice || {};
    setVoice({
      preferredTone: bv.preferredTone || "",
      writingPrinciples: (bv.writingPrinciples || []).join("\n"),
      wordsToAvoid: (bv.wordsToAvoid || []).join(", "),
      examples: (bv.examples || []).join("\n"),
    });
  }

  useEffect(() => {
    if (workspaceId) load().catch((err) => showToast(err.displayMessage, "error"));
  }, [workspaceId]);

  if (!ws) return <Spinner />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Workspace settings</h1>
      {workspace?.isSyntheticDemo && (
        <p className="text-sm bg-blue-50 border border-blue-200 rounded-lg p-3">
          This is the synthetic NovaPay Digital demonstration workspace. It is not a real brand.
        </p>
      )}
      <form
        className="card p-4 space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          await api.patch(`/workspaces/${workspaceId}`, {
            brandVoice: {
              preferredTone: voice.preferredTone,
              writingPrinciples: voice.writingPrinciples.split("\n").filter(Boolean),
              wordsToAvoid: voice.wordsToAvoid.split(",").map((s) => s.trim()).filter(Boolean),
              examples: voice.examples.split("\n").filter(Boolean),
            },
          });
          showToast("Brand voice saved", "success");
          reload();
        }}
      >
        <h2 className="font-semibold">Brand voice</h2>
        <label className="label">Preferred tone</label>
        <input className="input" value={voice.preferredTone} onChange={(e) => setVoice({ ...voice, preferredTone: e.target.value })} />
        <label className="label">Writing principles (one per line)</label>
        <textarea className="input min-h-[80px]" value={voice.writingPrinciples} onChange={(e) => setVoice({ ...voice, writingPrinciples: e.target.value })} />
        <label className="label">Words to avoid (comma separated)</label>
        <input className="input" value={voice.wordsToAvoid} onChange={(e) => setVoice({ ...voice, wordsToAvoid: e.target.value })} />
        <label className="label">Examples (one per line)</label>
        <textarea className="input min-h-[80px]" value={voice.examples} onChange={(e) => setVoice({ ...voice, examples: e.target.value })} />
        <button className="btn-primary">Save brand voice</button>
      </form>

      <div className="card p-4">
        <h2 className="font-semibold mb-3">Members</h2>
        {members.map((m) => (
          <div key={m._id} className="flex justify-between py-2 border-b text-sm">
            <span>
              {m.user?.name} · {m.user?.email}
            </span>
            <div className="flex gap-2">
              <select
                className="input w-36"
                value={m.role}
                onChange={async (e) => {
                  await api.patch(`/workspaces/${workspaceId}/members/${m._id}`, { role: e.target.value });
                  load();
                }}
              >
                {["ADMIN", "CREATOR", "MANAGER", "REVIEWER"].map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
              <button
                className="btn-danger"
                onClick={async () => {
                  await api.delete(`/workspaces/${workspaceId}/members/${m._id}`);
                  load();
                }}
              >
                Remove
              </button>
            </div>
          </div>
        ))}
        <form
          className="flex gap-2 mt-4"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await api.post(`/workspaces/${workspaceId}/members`, { email, role });
              setEmail("");
              load();
            } catch (err) {
              showToast(err.displayMessage, "error");
            }
          }}
        >
          <input className="input" placeholder="User email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <select className="input w-40" value={role} onChange={(e) => setRole(e.target.value)}>
            {["ADMIN", "CREATOR", "MANAGER", "REVIEWER"].map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
          <button className="btn-primary">Invite</button>
        </form>
      </div>
    </div>
  );
}
