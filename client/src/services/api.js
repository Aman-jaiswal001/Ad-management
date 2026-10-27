import axios from "axios";

const api = axios.create({
  baseURL: "/api",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("inkloom_token");
  const workspaceId = localStorage.getItem("inkloom_workspace");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  if (workspaceId) config.headers["X-Workspace-Id"] = workspaceId;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const message = err.response?.data?.error || err.message || "Request failed";
    return Promise.reject(Object.assign(err, { displayMessage: message }));
  }
);

export default api;
