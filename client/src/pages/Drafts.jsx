import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api.js";
import Spinner from "../components/Spinner.jsx";
import EmptyState from "../components/EmptyState.jsx";

export default function Drafts() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/drafts")
      .then((res) => setItems(res.data.items))
      .catch((err) => setError(err.displayMessage))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;
  if (error) return <p className="text-red-600">{error}</p>;
  if (!items.length) {
    return (
      <EmptyState
        title="No drafts"
        body="Create a review to store a draft in this workspace."
        action={
          <Link to="/reviews/new" className="btn-primary mt-4">
            New review
          </Link>
        }
      />
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-semibold">My drafts</h1>
        <Link className="btn-primary" to="/reviews/new">
          New review
        </Link>
      </div>
      <div className="card divide-y">
        {items.map((d) => (
          <Link key={d._id} to={`/drafts/${d._id}`} className="flex justify-between p-4 hover:bg-slate-50">
            <div>
              <p className="font-medium">{d.title}</p>
              <p className="text-xs text-slate-500">
                {d.contentType} · rev {d.currentRevision}
              </p>
            </div>
            <span className="text-sm text-slate-600">{d.status}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
