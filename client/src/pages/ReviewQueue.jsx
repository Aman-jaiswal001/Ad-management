import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api.js";
import Spinner from "../components/Spinner.jsx";
import EmptyState from "../components/EmptyState.jsx";
import { useAuth } from "../context/AuthContext.jsx";

export default function ReviewQueue() {
  const { showToast } = useAuth();
  const [items, setItems] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const drafts = await api.get("/drafts", { params: { queue: true } });
    setItems(drafts.data.items);
    try {
      const mem = await api.get(`/workspaces/${localStorage.getItem("inkloom_workspace")}/members`);
      setMembers(mem.data.items);
    } catch {
      setMembers([]);
    }
  }

  useEffect(() => {
    load()
      .catch((err) => showToast(err.displayMessage, "error"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;
  if (!items.length) return <EmptyState title="Queue is empty" body="No drafts are waiting for review." />;

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Review queue</h1>
      <div className="card divide-y">
        {items.map((d) => (
          <div key={d._id} className="p-4 flex flex-wrap justify-between gap-3">
            <div>
              <Link className="font-medium" to={`/drafts/${d._id}`}>
                {d.title}
              </Link>
              <p className="text-xs text-slate-500">
                {d.status} · {d.creator?.name} · assigned {d.assignedReviewer?.name || "none"}
              </p>
            </div>
            <select
              className="input w-56"
              defaultValue=""
              onChange={async (e) => {
                if (!e.target.value) return;
                await api.post(`/drafts/${d._id}/assign`, { reviewerId: e.target.value });
                showToast("Reviewer assigned", "success");
                load();
              }}
            >
              <option value="">Assign reviewer</option>
              {members.map((m) => (
                <option key={m._id} value={m.user?._id}>
                  {m.user?.name} ({m.role})
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}
