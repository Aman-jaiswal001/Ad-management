import { useEffect, useState } from "react";
import api from "../services/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import Spinner from "../components/Spinner.jsx";
import EmptyState from "../components/EmptyState.jsx";

function ResourcePage({ title, path, fields, toItem, render }) {
  const { role, showToast } = useAuth();
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data } = await api.get(path);
    setItems(data.items);
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [path]);

  async function create(e) {
    e.preventDefault();
    try {
      await api.post(path, toItem(form));
      showToast("Saved", "success");
      setForm({});
      await load();
    } catch (err) {
      showToast(err.displayMessage, "error");
    }
  }

  async function remove(id) {
    if (!window.confirm("Delete this record?")) return;
    await api.delete(`${path}/${id}`);
    load();
  }

  if (loading) return <Spinner />;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{title}</h1>
      {role === "ADMIN" && (
        <form onSubmit={create} className="card p-4 grid md:grid-cols-2 gap-3">
          {fields.map((f) => (
            <div key={f.name} className={f.full ? "md:col-span-2" : ""}>
              <label className="label">{f.label}</label>
              {f.type === "textarea" ? (
                <textarea
                  className="input min-h-[80px]"
                  value={form[f.name] || ""}
                  onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                  required={f.required}
                />
              ) : (
                <input
                  className="input"
                  value={form[f.name] || ""}
                  onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                  required={f.required}
                />
              )}
            </div>
          ))}
          <div className="md:col-span-2">
            <button className="btn-primary">Add</button>
          </div>
        </form>
      )}
      {!items.length ? (
        <EmptyState title="Nothing here yet" body="Add records to use them in reviews." />
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item._id} className="card p-4 flex justify-between gap-3">
              <div className="text-sm">{render(item)}</div>
              {role === "ADMIN" && (
                <button className="btn-danger h-fit" onClick={() => remove(item._id)}>
                  Delete
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function GuidelinesPage() {
  return (
    <ResourcePage
      title="Guidelines / brand rules"
      path="/rules"
      fields={[
        { name: "title", label: "Title", required: true },
        { name: "severity", label: "Severity (Low/Medium/High/Critical)", required: true },
        { name: "ruleText", label: "Rule text", type: "textarea", required: true, full: true },
        { name: "exactPhrases", label: "Exact phrases (comma separated)", full: true },
      ]}
      toItem={(f) => ({
        title: f.title,
        severity: f.severity || "Medium",
        ruleText: f.ruleText,
        description: f.ruleText,
        exactPhrases: (f.exactPhrases || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      })}
      render={(item) => (
        <>
          <p className="font-medium">
            {item.title} · {item.severity} · {item.approvalStatus}
          </p>
          <p>{item.ruleText}</p>
        </>
      )}
    />
  );
}

export function ClaimsPage() {
  return (
    <ResourcePage
      title="Approved claims"
      path="/claims"
      fields={[
        { name: "claimText", label: "Claim text", type: "textarea", required: true, full: true },
        { name: "supportingEvidence", label: "Supporting evidence", type: "textarea", full: true },
        { name: "sourceOwner", label: "Source owner" },
        { name: "expiresAt", label: "Expiry (ISO date, optional)" },
      ]}
      toItem={(f) => f}
      render={(item) => (
        <>
          <p className="font-medium">{item.claimText}</p>
          <p className="text-slate-600">{item.supportingEvidence}</p>
          <p className="text-xs text-slate-500">
            {item.approvalStatus} · updated {new Date(item.updatedAt).toLocaleDateString()} · expires{" "}
            {item.expiresAt ? new Date(item.expiresAt).toLocaleDateString() : "n/a"}
          </p>
        </>
      )}
    />
  );
}

export function TerminologyPage() {
  return (
    <ResourcePage
      title="Terminology"
      path="/terminology"
      fields={[
        { name: "officialTerm", label: "Official term", required: true },
        { name: "prohibitedVariants", label: "Prohibited variants (comma separated)", required: true },
        { name: "explanation", label: "Explanation", type: "textarea", full: true },
        { name: "suggestedReplacement", label: "Suggested replacement" },
      ]}
      toItem={(f) => ({
        ...f,
        prohibitedVariants: (f.prohibitedVariants || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      })}
      render={(item) => (
        <>
          <p className="font-medium">{item.officialTerm}</p>
          <p>Avoid: {(item.prohibitedVariants || []).join(", ")}</p>
          <p className="text-slate-600">{item.explanation}</p>
        </>
      )}
    />
  );
}

export function AssetsPage() {
  const { role, showToast } = useAuth();
  const [items, setItems] = useState([]);
  const [file, setFile] = useState(null);
  const [name, setName] = useState("");
  const [assetType, setAssetType] = useState("logo");

  async function load() {
    const { data } = await api.get("/assets");
    setItems(data.items);
  }
  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Brand assets</h1>
      {role === "ADMIN" && (
        <form
          className="card p-4 flex flex-wrap gap-3 items-end"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = new FormData();
            form.append("file", file);
            form.append("name", name);
            form.append("assetType", assetType);
            try {
              await api.post("/assets", form);
              showToast("Asset uploaded", "success");
              load();
            } catch (err) {
              showToast(err.displayMessage, "error");
            }
          }}
        >
          <input className="input w-48" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
          <input className="input w-40" value={assetType} onChange={(e) => setAssetType(e.target.value)} />
          <input type="file" required onChange={(e) => setFile(e.target.files[0])} />
          <button className="btn-primary">Upload</button>
        </form>
      )}
      {!items.length && <EmptyState title="No assets" body="Upload approved logos or files. Visual review is not performed." />}
      {items.map((a) => (
        <div key={a._id} className="card p-4 flex justify-between">
          <div>
            <p className="font-medium">
              {a.name} · {a.assetType} · v{a.version}
            </p>
            <p className="text-xs text-slate-500">{a.approvalStatus}</p>
          </div>
          {role === "ADMIN" && (
            <button className="btn-danger" onClick={() => api.delete(`/assets/${a._id}`).then(load)}>
              Delete
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
