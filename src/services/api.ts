import axios from "axios";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "/api";

const api = axios.create({
  baseURL: apiBaseUrl,
});

function isAuthPublicEndpoint(url?: string): boolean {
  if (!url) {
    return false;
  }

  const normalizedUrl = url.toLowerCase();
  return (
    normalizedUrl.includes('/auth/login') ||
    normalizedUrl.includes('/auth/register') ||
    normalizedUrl.includes('/account/register')
  );
}

api.interceptors.request.use((config) => {
  if (isAuthPublicEndpoint(config.url)) {
    return config;
  }

  const token = localStorage.getItem("token");

  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const requestUrl = error?.config?.url as string | undefined;
    if (error?.response?.status === 401 && !isAuthPublicEndpoint(requestUrl)) {
      window.location.href = "/login";
    }

    return Promise.reject(error);
  }
);

export default api;
