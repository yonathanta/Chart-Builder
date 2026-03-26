import axios from "axios";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "/api";

const api = axios.create({
  baseURL: apiBaseUrl,
  timeout: 30000,
});

function extractApiErrorMessage(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }

  const responseData = (error as {
    response?: {
      data?: {
        error?: string;
        message?: string;
        title?: string;
        details?: string | string[];
        errors?: Record<string, string[]>;
      } | string;
    };
  }).response?.data;

  if (typeof responseData === "string" && responseData.trim().length > 0) {
    return responseData;
  }

  if (typeof responseData === "object" && responseData !== null) {
    if (typeof responseData.details === "string" && responseData.details.trim().length > 0) {
      return responseData.details;
    }

    if (Array.isArray(responseData.details) && responseData.details.length > 0) {
      const detail = responseData.details.find(
        (value) => typeof value === "string" && value.trim().length > 0,
      );
      if (detail) {
        return detail;
      }
    }

    if (responseData.errors && typeof responseData.errors === "object") {
      const firstFieldError = Object.values(responseData.errors)
        .find((messages) => Array.isArray(messages) && messages.length > 0)
        ?.[0];

      if (typeof firstFieldError === "string" && firstFieldError.trim().length > 0) {
        return firstFieldError;
      }
    }

    const apiMessage = responseData.error ?? responseData.message ?? responseData.title;
    if (typeof apiMessage === "string" && apiMessage.trim().length > 0) {
      return apiMessage;
    }
  }

  return undefined;
}

function isAuthPublicEndpoint(url?: string): boolean {
  if (!url) {
    return false;
  }

  const normalizedUrl = url.toLowerCase();
  return (
    normalizedUrl.includes('/auth/login') ||
    normalizedUrl.includes('/auth/register') ||
    normalizedUrl.includes('/auth/forgot-password') ||
    normalizedUrl.includes('/auth/reset-password') ||
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
    const status = error?.response?.status as number | undefined;
    const requestUrl = error?.config?.url as string | undefined;
    if (status === 401 && !isAuthPublicEndpoint(requestUrl)) {
      window.location.href = "/login";
    }

    const normalizedMessage = extractApiErrorMessage(error);
    if (normalizedMessage && typeof error?.message === "string") {
      error.message = normalizedMessage;
    }

    if (status && status >= 500) {
      const method = (error?.config?.method as string | undefined)?.toUpperCase() ?? "GET";
      const suffix = normalizedMessage ? `: ${normalizedMessage}` : "";
      console.error(`API ${status} on ${method} ${requestUrl ?? "(unknown-url)"}${suffix}`);
    }

    return Promise.reject(error);
  }
);

export default api;
