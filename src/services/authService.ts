import api from "./api";

type AuthUser = {
  id?: string;
  email?: string;
  role?: string;
};

type AuthResponse = {
  token?: string;
  user?: AuthUser;
};

type ForgotPasswordResponse = {
  message?: string;
  resetLink?: string | null;
  expiresAtUtc?: string | null;
};

type ResetPasswordResponse = {
  message?: string;
};

const TOKEN_KEY = "token";
const USER_KEY = "user";

function persistAuthData(data: AuthResponse): void {
  if (typeof data.token === "string" && data.token.length > 0) {
    localStorage.setItem(TOKEN_KEY, data.token);
  }

  if (data.user !== undefined) {
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  }
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const response = await api.post<AuthResponse>("/auth/login", { email, password });
  const data = response.data;

  persistAuthData(data);

  return data;
}

export async function register(email: string, password: string, fullName: string): Promise<AuthResponse> {
  const response = await api.post<AuthResponse>("/auth/register", {
    email,
    password,
    fullName,
  });

  return response.data;
}

export async function forgotPassword(email: string): Promise<ForgotPasswordResponse> {
  const response = await api.post<ForgotPasswordResponse>("/auth/forgot-password", { email });
  return response.data;
}

export async function resetPassword(token: string, newPassword: string): Promise<ResetPasswordResponse> {
  const response = await api.post<ResetPasswordResponse>("/auth/reset-password", { token, newPassword });
  return response.data;
}

const authService = {
  login,
  register,
  forgotPassword,
  resetPassword,
};

export default authService;
