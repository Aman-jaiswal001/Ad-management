export default function EmptyState({ title, body, action }) {
  return (
    <div className="card p-10 text-center text-slate-600">
      <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
      <p className="mt-2 text-sm">{body}</p>
      {action}
    </div>
  );
}
