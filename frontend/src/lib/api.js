import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";
export const API = `${BACKEND_URL}/api`;

const api = axios.create({
  baseURL: API,
  withCredentials: true,
});

api.interceptors.request.use((cfg) => {
  const tok = localStorage.getItem("oncost_token");
  if (tok) cfg.headers.Authorization = `Bearer ${tok}`;
  return cfg;
});

export default api;

export const imageUrl = (filename) => {
  if (!filename) return null;
  if (filename.startsWith("http://") || filename.startsWith("https://") || filename.startsWith("data:")) {
    return filename;
  }
  // Catalog product images bundled in frontend/public/images/ for high-speed CDN delivery
  if (filename.startsWith("SG_")) {
    return `/images/${filename}`;
  }
  return `${API}/images/${filename}`;
};

export const formatINR = (n) => {
  if (n === null || n === undefined || isNaN(n)) return "—";
  return `₹ ${Number(n).toLocaleString("en-IN")}`;
};

export const shareLink = (token) => `${window.location.origin}/q/${token}`;
