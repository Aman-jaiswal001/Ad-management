import { useEffect, useState } from "react";
import api from "../services/api.js";
import Spinner from "../components/Spinner.jsx";
import EmptyState from "../components/EmptyState.jsx";

export default function AuditLogs() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/audit-logs")
      .then((res) => setData(res.data))
      .catch((err) => setError(err.displayMessage));
  }, []);

  if (error) return <p className="text-red-600">{error}</p>;
  if (!data) return <Spinner />;
  if (!data.items.length) return <EmptyState title="No audit events" body="Actions will appear here." />;

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Audit logs</h1>
      <div className="card divide-y">
        {data.items.map((row) => (
          <div key={row._id} className="p-3 text-sm">
            <p className="font-medium">{row.action}</p>
            <p className="text-slate-500">
              {row.actor?.email || "system"} · {row.targetType} · {new Date(row.createdAt).toLocaleString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
