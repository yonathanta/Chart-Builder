import api from "./api";

type AuthResponse = {
  token?: string;
  user?: unknown;
  [key: string]: unknown;
};

const TOKEN_KEY = "token";
const USER_KEY = "user";

function persistAuthData(data: AuthResponse): void {
  if (typeof data.token === "string" && data.token.length > 0) {
    localStorage.setItem(TOKEN_KEY, data.token);
  }

  if (data.user !== undefined) {
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    return;
  }

  const hasFlatUserData =
    data.userId !== undefined ||
    data.email !== undefined ||
    data.role !== undefined ||
    data.UserId !== undefined ||
    data.Email !== undefined ||
    data.Role !== undefined;
  if (hasFlatUserData) {
    localStorage.setItem(
      USER_KEY,
      JSON.stringify({
        userId: data.userId ?? data.UserId,
        email: data.email ?? data.Email,
        role: data.role ?? data.Role,
        expiresAtUtc: data.expiresAtUtc ?? data.ExpiresAtUtc,
      })
    );
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

const authService = {
  login,
  register,
};

export default authService;
