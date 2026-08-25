import axios from "axios";

// Uses VITE_API_URL when set (in production / deployed builds), and falls
// back to localhost for local development so nothing breaks if the .env
// variable isn't set yet.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5001/api",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

// Backend responses use { success, message, data, error }. Existing pages
// consume response.data directly, so unwrap only normal JSON responses here.
// Blob responses are exports and must remain untouched.
api.interceptors.response.use((response) => {
  if (response.config.responseType !== "blob" && response.data?.success === true) {
    response.data = response.data.data;
  }
  return response;
});

export default api;
