import { ConvexHttpClient } from "convex/browser";

const convexUrl = import.meta.env.VITE_CONVEX_URL;

let singletonClient: ConvexHttpClient | null = null;
let authToken: string | null = null;

export function hasConvexAuthToken(): boolean {
  return Boolean(authToken);
}

export function getConvexClient(): ConvexHttpClient | null {
  if (!convexUrl) {
    return null;
  }

  if (!singletonClient) {
    singletonClient = new ConvexHttpClient(convexUrl);
    if (authToken) {
      singletonClient.setAuth(authToken);
    }
  }

  return singletonClient;
}

export function setConvexAuthToken(token: string): void {
  authToken = token;
  const client = getConvexClient();
  if (!client) {
    return;
  }

  client.setAuth(token);
}

export function clearConvexAuthToken(): void {
  authToken = null;
  const client = getConvexClient();
  if (!client) {
    return;
  }

  client.clearAuth();
}
