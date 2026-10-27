import { useAuth } from "../context/AuthContext.jsx";

export default function Toast() {
  const { toast } = useAuth();
  if (!toast) return null;
  const color =
    toast.type === "error" ? "bg-red-600" : toast.type === "success" ? "bg-emerald-600" : "bg-navy-800";
  return (
    <div className={`fixed bottom-4 right-4 z-50 ${color} text-white px-4 py-3 rounded-lg shadow-lg max-w-sm`}>
      {toast.message}
    </div>
  );
}
