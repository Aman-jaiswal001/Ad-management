export default function ConfirmDialog({ open, title, body, confirmLabel = "Confirm", onConfirm, onClose }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div className="card max-w-md w-full p-5">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-sm text-slate-600 mt-2">{body}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button className="btn-secondary" onClick={onClose} type="button">
            Cancel
          </button>
          <button className="btn-primary" onClick={onConfirm} type="button">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
