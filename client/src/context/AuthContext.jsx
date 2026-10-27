import { createContext, useContext, useEffect, useMemo, useState } from "react";
import api from "../services/api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [memberships, setMemberships] = useState([]);
  const [workspaceId, setWorkspaceId] = useState(localStorage.getItem("inkloom_workspace") || "");
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  function showToast(message, type = "info") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }

  async function loadMe() {
    const token = localStorage.getItem("inkloom_token");
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get("/auth/me");
      setUser(data.user);
      setMemberships(data.memberships || []);
      const current =
        workspaceId ||
        data.user.lastWorkspace ||
        data.memberships?.[0]?.workspace?._id;
      if (current) {
        localStorage.setItem("inkloom_workspace", current);
        setWorkspaceId(current);
      }
    } catch {
      localStorage.removeItem("inkloom_token");
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMe();
  }, []);

  async function login(email, password) {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("inkloom_token", data.token);
    await loadMe();
    return data;
  }

  async function register(payload) {
    const { data } = await api.post("/auth/register", payload);
    localStorage.setItem("inkloom_token", data.token);
    if (data.workspace?._id) {
      localStorage.setItem("inkloom_workspace", data.workspace._id);
      setWorkspaceId(data.workspace._id);
    }
    await loadMe();
    return data;
  }

  function logout() {
    localStorage.removeItem("inkloom_token");
    localStorage.removeItem("inkloom_workspace");
    setUser(null);
    setMemberships([]);
    setWorkspaceId("");
  }

  function selectWorkspace(id) {
    localStorage.setItem("inkloom_workspace", id);
    setWorkspaceId(id);
  }

  const role = useMemo(() => {
    const m = memberships.find((x) => x.workspace?._id === workspaceId);
    return m?.role || "";
  }, [memberships, workspaceId]);

  const workspace = useMemo(
    () => memberships.find((x) => x.workspace?._id === workspaceId)?.workspace,
    [memberships, workspaceId]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        workspace,
        workspaceId,
        memberships,
        loading,
        login,
        register,
        logout,
        selectWorkspace,
        toast,
        showToast,
        reload: loadMe,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
