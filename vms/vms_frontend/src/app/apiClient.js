import axios from "axios";

const apiClient = axios.create({
  baseURL: "/api",
});

apiClient.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      console.warn("Unauthorized request detected (invalid token or password changed). Logging out...");
      const currentToken = sessionStorage.getItem("token");
      if (currentToken) {
        try {
          const currentUser = JSON.parse(sessionStorage.getItem("user") || "{}");
          if (currentUser && currentUser.email) {
            localStorage.setItem("last_logged_out_email", currentUser.email);
            localStorage.setItem("remote_login_pending", "true");
          }
        } catch (e) {
          console.error("Failed to parse user details for remote login fallback:", e);
        }
        sessionStorage.removeItem("token");
        sessionStorage.removeItem("role");
        sessionStorage.removeItem("user");
        window.location.href = "/";
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
