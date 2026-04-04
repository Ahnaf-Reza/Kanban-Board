import { createAuthClient } from "better-auth/react";

function resolveBetterAuthBaseUrl(): string {
  const raw = (import.meta.env.VITE_BETTER_AUTH_URL as string | undefined)?.trim() || "/api/auth";

  if (/^https?:\/\//i.test(raw)) {
    if (typeof window !== "undefined") {
      const configuredUrl = new URL(raw);
      // Avoid cross-origin auth calls in the browser to prevent CORS/cookie issues.
      if (configuredUrl.origin !== window.location.origin) {
        return new URL("/api/auth", window.location.origin).toString();
      }
    }
    return raw;
  }

  if (raw.startsWith("/") && typeof window !== "undefined") {
    return new URL(raw, window.location.origin).toString();
  }

  throw new Error(
    `Invalid Better Auth base URL: ${raw}. Use an absolute URL or an origin-relative path like /api/auth.`,
  );
}

const betterAuthBaseUrl = resolveBetterAuthBaseUrl();

function toTokenEndpoint(baseUrl: string): string {
  const normalized = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  if (/^https?:\/\//i.test(normalized)) {
    return new URL("token", normalized).toString();
  }

  return `${normalized}token`;
}

export const authClient = createAuthClient({
  baseURL: betterAuthBaseUrl,
  sessionOptions: {
    refetchOnWindowFocus: false,
    refetchInterval: 15 * 60,
  },
  fetchOptions: {
    credentials: "include",
  },
});

type BetterAuthErrorPayload = {
  message?: string;
  error?: string;
  code?: string;
};

type LinkedAccount = {
  providerId: string;
  accountId: string;
};

function toRouteUrl(route: string): string {
  const normalizedBase = betterAuthBaseUrl.endsWith("/") ? betterAuthBaseUrl.slice(0, -1) : betterAuthBaseUrl;
  const normalizedRoute = route.startsWith("/") ? route : `/${route}`;
  return `${normalizedBase}${normalizedRoute}`;
}

async function parseErrorPayload(response: Response): Promise<BetterAuthErrorPayload | null> {
  try {
    const payload = (await response.json()) as BetterAuthErrorPayload;
    return payload;
  } catch {
    return null;
  }
}

async function callAuthJson<TResponse>(route: string, init?: RequestInit): Promise<TResponse> {
  const response = await fetch(toRouteUrl(route), {
    credentials: "include",
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : null),
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const errorPayload = await parseErrorPayload(response);
    const fallback = `Request to ${route} failed with status ${response.status}.`;
    throw new Error(errorPayload?.message || errorPayload?.error || fallback);
  }

  return (await response.json()) as TResponse;
}

export async function listLinkedAccounts(): Promise<LinkedAccount[]> {
  const result = await callAuthJson<LinkedAccount[]>("/list-accounts", {
    method: "GET",
  });

  return Array.isArray(result)
    ? result.map((item) => ({
        providerId: typeof item.providerId === "string" ? item.providerId : "",
        accountId: typeof item.accountId === "string" ? item.accountId : "",
      }))
    : [];
}

export async function updateUserProfile(payload: { name?: string }): Promise<void> {
  await callAuthJson<{ status: boolean }>("/update-user", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await callAuthJson<{ user: unknown }>("/change-password", {
    method: "POST",
    body: JSON.stringify({
      currentPassword,
      newPassword,
    }),
  });
}

export async function setPassword(newPassword: string): Promise<void> {
  await callAuthJson<{ status: boolean }>("/set-password", {
    method: "POST",
    body: JSON.stringify({
      newPassword,
    }),
  });
}

export async function deleteCurrentUser(password?: string): Promise<void> {
  await callAuthJson<{ success: boolean; message: string }>("/delete-user", {
    method: "POST",
    body: JSON.stringify(password ? { password } : {}),
  });
}

export async function fetchConvexJwtToken(): Promise<string | null> {
  if (!betterAuthBaseUrl) {
    throw new Error("VITE_BETTER_AUTH_URL is missing. Add it to .env.local.");
  }

  const response = await fetch(toTokenEndpoint(betterAuthBaseUrl), {
    method: "GET",
    credentials: "include",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as { token?: unknown };
  if (typeof payload.token !== "string" || payload.token.length === 0) {
    return null;
  }

  return payload.token;
}

export function getConfiguredOauthProviders(): string[] {
  const raw = import.meta.env.VITE_BETTER_AUTH_OAUTH_PROVIDERS as string | undefined;
  if (!raw) {
    return ["google"];
  }

  return raw
    .split(",")
    .map((provider: string) => provider.trim())
    .filter((provider: string) => provider.length > 0);
}
