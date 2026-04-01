import { createAuthClient } from "better-auth/react";

function resolveBetterAuthBaseUrl(): string {
  const raw = (import.meta.env.VITE_BETTER_AUTH_URL as string | undefined)?.trim() || "/api/auth";

  if (/^https?:\/\//i.test(raw)) {
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
  fetchOptions: {
    credentials: "include",
  },
});

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
