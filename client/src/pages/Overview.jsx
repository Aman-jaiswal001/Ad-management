import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import api from "../services/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import Spinner from "../components/Spinner.jsx";
import EmptyState from "../components/EmptyState.jsx";

export default function Overview() {
  const { workspaceId, role } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId) return;
    setLoading(true);
    api
      .get("/analytics/overview")
      .then((res) => setData(res.data))
      .catch((err) => {
        if (err.response?.status === 403) {
          return api.get("/drafts", { params: { mine: true } }).then((r) => {
            setData({
              totalReviews: 0,
              pendingReviews: 0,
              highSeverityFindings: 0,
              approvedDrafts: 0,
              averageTurnaroundHours: 0,
              findingsBySeverity: [],
              findingsByCategory: [],
              recentDrafts: r.data.items,
              recentApprovals: [],
              itemsRequiringVerification: 0,
              recurringTerminology: [],
              creatorView: true,
            });
          });
        }
        setError(err.displayMessage);
      })
      .finally(() => setLoading(false));
  }, [workspaceId]);

  if (loading) return <Spinner />;
  if (error) return <p className="text-red-600">{error}</p>;
  if (!data) return <EmptyState title="No analytics yet" body="Run a review after adding brand sources." />;

  const cards = [
    ["Total reviews", data.totalReviews],
    ["Pending reviews", data.pendingReviews],
    ["High-severity findings", data.highSeverityFindings],
    ["Approved drafts", data.approvedDrafts],
    ["Avg. turnaround (hours)", data.averageTurnaroundHours],
    ["Needs verification", data.itemsRequiringVerification],
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Overview</h1>
        <p className="text-sm text-slate-600">Figures come from MongoDB records in this workspace.</p>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map(([label, value]) => (
          <div key={label} className="card p-5">
            <p className="text-sm text-slate-500">{label}</p>
            <p className="text-2xl font-semibold mt-1">{value ?? 0}</p>
          </div>
        ))}
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <h2 className="font-semibold mb-3">Findings by severity</h2>
          {data.findingsBySeverity?.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.findingsBySeverity.map((x) => ({ name: x._id, count: x.count }))}>
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#2563eb" radius={6} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-slate-500">No findings recorded yet.</p>
          )}
        </div>
        <div className="card p-5">
          <h2 className="font-semibold mb-3">Most common categories</h2>
          <ul className="text-sm space-y-2">
            {(data.findingsByCategory || []).slice(0, 6).map((x) => (
              <li key={x._id} className="flex justify-between">
                <span>{x._id}</span>
                <span className="font-medium">{x.count}</span>
              </li>
            ))}
            {!data.findingsByCategory?.length && <li className="text-slate-500">No category data.</li>}
          </ul>
        </div>
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <h2 className="font-semibold mb-3">Recent drafts</h2>
          {(data.recentDrafts || []).map((d) => (
            <Link key={d._id} to={`/drafts/${d._id}`} className="block py-2 border-b border-slate-100 text-sm">
              {d.title} <span className="text-slate-500">· {d.status}</span>
            </Link>
          ))}
          {!data.recentDrafts?.length && <p className="text-sm text-slate-500">No drafts yet.</p>}
        </div>
        <div className="card p-5">
          <h2 className="font-semibold mb-3">Recent decisions</h2>
          {(data.recentApprovals || []).map((a) => (
            <p key={a._id} className="py-2 border-b border-slate-100 text-sm">
              {a.decision} · {a.draft?.title} · {a.reviewer?.name}
            </p>
          ))}
          {!data.recentApprovals?.length && <p className="text-sm text-slate-500">No approval decisions yet.</p>}
        </div>
      </div>
      <div className="card p-5">
        <h2 className="font-semibold mb-3">Recurring terminology errors</h2>
        {(data.recurringTerminology || []).length ? (
          <ul className="text-sm">
            {data.recurringTerminology.map((t) => (
              <li key={t._id} className="flex justify-between py-1">
                <span>{t._id || "(empty)"}</span>
                <span>{t.count}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">No terminology flags stored yet.</p>
        )}
      </div>
      {role === "CREATOR" && data.creatorView && (
        <p className="text-xs text-slate-500">Creators see their drafts; full analytics require Admin or Manager.</p>
      )}
    </div>
  );
}
