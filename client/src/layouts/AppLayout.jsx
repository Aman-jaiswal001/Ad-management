import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import {
  BarChart3,
  BookOpen,
  ClipboardList,
  FileText,
  Folders,
  Home,
  Image,
  ListChecks,
  LogOut,
  PlusCircle,
  ScrollText,
  Settings,
  Shield,
  Type,
  Menu,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import Toast from "../components/Toast.jsx";

const NAV = [
  { to: "/", label: "Overview", icon: Home },
  { to: "/reviews/new", label: "New Review", icon: PlusCircle },
  { to: "/drafts", label: "My Drafts", icon: FileText },
  { to: "/queue", label: "Review Queue", icon: ClipboardList, roles: ["ADMIN", "MANAGER", "REVIEWER"] },
  { to: "/knowledge", label: "Brand Knowledge Base", icon: BookOpen },
  { to: "/guidelines", label: "Guidelines", icon: Shield },
  { to: "/claims", label: "Approved Claims", icon: ListChecks },
  { to: "/terminology", label: "Terminology", icon: Type },
  { to: "/assets", label: "Brand Assets", icon: Image },
  { to: "/analytics", label: "Analytics", icon: BarChart3, roles: ["ADMIN", "MANAGER"] },
  { to: "/audit", label: "Audit Logs", icon: ScrollText, roles: ["ADMIN"] },
  { to: "/settings", label: "Workspace Settings", icon: Settings, roles: ["ADMIN"] },
];

export default function AppLayout() {
  const { user, role, workspace, memberships, selectWorkspace, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const visibleNav = NAV.filter((item) => !item.roles || item.roles.includes(role));

  return (
    <div className="min-h-screen flex bg-slate-100">
      <aside className="w-64 shrink-0 bg-navy-900 text-slate-200 hidden md:flex flex-col md:sticky md:top-0 md:h-screen">
        <div className="px-5 py-6 border-b border-white/10">
          <div className="flex items-center gap-2 text-white font-semibold text-lg">
            <Folders className="h-5 w-5 text-blue-400" />
            Inkloom AI
          </div>
          <p className="text-xs text-slate-400 mt-1">Brand governance</p>
        </div>
        <nav className="flex-1 overflow-y-auto py-3">
          {visibleNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 px-5 py-2.5 text-sm ${
                  isActive ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/5"
                }`
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-white/10 text-xs text-slate-400">
          Content is never auto-published.
        </div>
      </aside>
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="bg-white border-b border-slate-200 px-4 md:px-8 py-3 flex flex-wrap items-center gap-3 justify-between">
          <button className="btn-secondary md:hidden !p-2" aria-label={menuOpen ? "Close navigation" : "Open navigation"} aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>
            {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
          <div>
            <p className="text-sm font-medium">{workspace?.name || "Select a workspace"}</p>
            <p className="text-xs text-slate-500">
              {user?.name} · {role || "no role"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              className="input w-full sm:w-56"
              value={workspace?._id || ""}
              onChange={(e) => selectWorkspace(e.target.value)}
            >
              {memberships.map((m) => (
                <option key={m.workspace._id} value={m.workspace._id}>
                  {m.workspace.name}
                </option>
              ))}
            </select>
            <button
              className="btn-secondary"
              onClick={() => {
                logout();
                navigate("/login");
              }}
            >
              <LogOut className="h-4 w-4" />
              Log out
            </button>
          </div>
        </header>
        {menuOpen && <>
          <button className="fixed inset-0 z-30 bg-black/40 md:hidden" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />
          <nav className="fixed inset-y-0 left-0 z-40 flex w-[min(18rem,85vw)] flex-col overflow-y-auto bg-navy-900 py-3 text-slate-200 shadow-xl md:hidden" aria-label="Main navigation">
            <div className="flex items-center justify-between border-b border-white/10 px-5 pb-4">
              <span className="font-semibold text-white">Inkloom AI</span>
              <button className="rounded p-2 hover:bg-white/10" aria-label="Close navigation" onClick={() => setMenuOpen(false)}><X className="h-5 w-5" /></button>
            </div>
            {visibleNav.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.to === "/"} onClick={() => setMenuOpen(false)} className={({ isActive }) => `flex items-center gap-3 px-5 py-3 text-sm ${isActive ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/5"}`}>
                <item.icon className="h-4 w-4" />{item.label}
              </NavLink>
            ))}
          </nav>
        </>}
        <main className="p-4 md:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
      <Toast />
    </div>
  );
}
