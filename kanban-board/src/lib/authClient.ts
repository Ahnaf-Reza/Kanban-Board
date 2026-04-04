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
const TOKEN_REQUEST_TIMEOUT_MS = 10000;

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

async function callAuthJsonWithFallback<TResponse>(routes: string[], init?: RequestInit): Promise<TResponse> {
  let lastError: Error | null = null;

  for (const route of routes) {
    try {
      return await callAuthJson<TResponse>(route, init);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Auth request failed.");
      const message = lastError.message.toLowerCase();
      if (!message.includes("status 404")) {
        throw lastError;
      }
    }
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error("Auth request failed.");
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

export async function updateUserProfile(payload: { name?: string; image?: string | null }): Promise<void> {
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
  const maybeClient = authClient as unknown as {
    setPassword?: (args: { newPassword: string }) => Promise<{ error?: { message?: string } | null }>;
  };

  if (typeof maybeClient.setPassword === "function") {
    const result = await maybeClient.setPassword({ newPassword });
    if (result?.error?.message) {
      throw new Error(result.error.message);
    }
    return;
  }

  await callAuthJsonWithFallback<{ status: boolean }>(["/set-password", "/setPassword", "/user/set-password"], {
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

  const abortController = new AbortController();
  const timeoutId = window.setTimeout(() => {
    abortController.abort();
  }, TOKEN_REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(toTokenEndpoint(betterAuthBaseUrl), {
      method: "GET",
      credentials: "include",
      signal: abortController.signal,
      headers: {
        Accept: "application/json",
      },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Fetching auth token timed out. Check Better Auth endpoint and environment variables.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }

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
