import { useEffect, useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import api from "../services/api.js";
import Spinner from "../components/Spinner.jsx";

export default function Analytics() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState(null);
  const [findings, setFindings] = useState(null);
  const [error, setError] = useState("");

  async function load() {
    setError("");
    try {
      const params = { from: from || undefined, to: to || undefined };
      const [o, f] = await Promise.all([
        api.get("/analytics/overview", { params }),
        api.get("/analytics/findings", { params }),
      ]);
      setData(o.data);
      setFindings(f.data);
    } catch (err) {
      setError(err.displayMessage);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (error) return <p className="text-red-600">{error}</p>;
  if (!data) return <Spinner />;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Analytics</h1>
      <form
        className="flex flex-wrap gap-3 items-end"
        onSubmit={(e) => {
          e.preventDefault();
          load();
        }}
      >
        <div>
          <label className="label">From</label>
          <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="label">To</label>
          <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <button className="btn-primary">Apply</button>
      </form>
      <div className="grid sm:grid-cols-3 gap-3">
        {[
          ["Accepted suggestions", data.suggestionStats?.accepted],
          ["Edited suggestions", data.suggestionStats?.edited],
          ["Dismissed findings", data.suggestionStats?.dismissed],
        ].map(([l, v]) => (
          <div key={l} className="card p-4">
            <p className="text-sm text-slate-500">{l}</p>
            <p className="text-xl font-semibold">{v || 0}</p>
          </div>
        ))}
      </div>
      <div className="card p-4">
        <h2 className="font-semibold mb-3">Findings by category</h2>
        {findings?.byCategory?.length ? (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={findings.byCategory.map((x) => ({ name: x._id, count: x.count }))}>
              <XAxis dataKey="name" hide />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#1d4ed8" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-slate-500">No finding records in this date range.</p>
        )}
      </div>
    </div>
  );
}
