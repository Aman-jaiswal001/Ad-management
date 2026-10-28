import { useEffect, useState } from "react";
import api from "../services/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import Spinner from "../components/Spinner.jsx";
import EmptyState from "../components/EmptyState.jsx";

export default function KnowledgeBase() {
  const { role, showToast } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState(null);
  const [name, setName] = useState("");
  const [uploading, setUploading] = useState(false);

  async function load() {
    const { data } = await api.get("/sources");
    setItems(data.items);
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  async function upload(e) {
      e.preventDefault();
    if (!file || uploading) return;
    const form = new FormData();
    form.append("file", file);
    form.append("name", name || file.name);
    setUploading(true);
    try {
      const res = await api.post("/sources/upload", form);
      if (res.data.warning) showToast(res.data.warning, "error");
      else showToast("Source uploaded", "success");
      setName("");
      setFile(null);
      await load();
    } catch (err) {
      showToast(err.displayMessage, "error");
    } finally {
      setUploading(false);
    }
  }

  if (loading) return <Spinner />;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Brand knowledge base</h1>
      <p className="text-sm text-slate-600">
        Only approved, active source versions are used as RAG evidence. Inactive or superseded versions are not
        cited silently.
      </p>
      {role === "ADMIN" && (
        <form onSubmit={upload} className="card p-4 flex flex-wrap gap-3 items-end">
          <div>
            <label className="label">Source name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <input required type="file" accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown" onChange={(e) => setFile(e.target.files[0])} />
          <button className="btn-primary" disabled={!file || uploading}>
            {uploading ? "Uploading & indexing…" : "Upload & index"}
          </button>
        </form>
      )}
      {!items.length ? (
        <EmptyState title="No sources" body="Admins can upload PDF or text guidelines." />
      ) : (
        <div className="overflow-x-auto card">
          <table className="w-full text-sm">
            <thead className="text-left bg-slate-50">
              <tr>
                {["Name", "Version", "Approval", "Active", "Extract", "Chunks", "Updated", ""].map((h) => (
                  <th key={h} className="p-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <tr key={s._id} className="border-t">
                  <td className="p-3">{s.name}</td>
                  <td className="p-3">{s.version}</td>
                  <td className="p-3">{s.approvalStatus}</td>
                  <td className="p-3">{s.isActiveVersion ? "yes" : "no"}</td>
                  <td className="p-3">{s.extractionStatus}</td>
                  <td className="p-3">{s.indexedChunkCount}</td>
                  <td className="p-3">{new Date(s.updatedAt).toLocaleString()}</td>
                  <td className="p-3 space-x-2">
                    {role === "ADMIN" && (
                      <>
                        <button
                          className="btn-secondary"
                          onClick={async () => {
                            try {
                              await api.post(`/sources/${s._id}/reindex`);
                              showToast("Reindexed", "success");
                              load();
                            } catch (err) {
                              showToast(err.displayMessage, "error");
                              load();
                            }
                          }}
                        >
                          Reindex
                        </button>
                        <button
                          className="btn-secondary"
                          onClick={async () => {
                            await api.patch(`/sources/${s._id}`, {
                              isActiveVersion: !s.isActiveVersion,
                              approvalStatus: s.approvalStatus,
                            });
                            load();
                          }}
                        >
                          Toggle active
                        </button>
                        <button
                          className="btn-danger"
                          onClick={async () => {
                            if (!window.confirm("Delete this source?")) return;
                            await api.delete(`/sources/${s._id}`);
                            load();
                          }}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  <a className="text-xs text-blue-700 underline" href={`${import.meta.env.VITE_API_URL || "/api"}/sources/${s._id}/download`} target="_blank" rel="noreferrer">View / download</a>
                  {s.indexingError && <p className="text-xs text-red-600">{s.indexingError}</p>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
