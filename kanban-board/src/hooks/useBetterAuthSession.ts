import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { authClient, fetchConvexJwtToken, sanitizeUserFacingErrorMessage } from "../lib/authClient";
import { clearConvexAuthToken, hasConvexAuthToken, setConvexAuthToken } from "../lib/convexClient";

const TOKEN_REFRESH_INTERVAL_MS = 15 * 60 * 1000;
const TOKEN_REFRESH_RETRY_DELAY_MS = 1200;
const TOKEN_REFRESH_MAX_RETRIES = 2;
const MAX_CONSECUTIVE_REFRESH_FAILURES = 3;

type AuthResultWithError = {
  error?: {
    message?: string;
  } | null;
};

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return sanitizeUserFacingErrorMessage(error.message, fallback);
  }
  return sanitizeUserFacingErrorMessage("", fallback);
}

function ensureNoAuthError(result: unknown, fallback: string): void {
  const maybeResult = result as AuthResultWithError;
  if (maybeResult?.error?.message) {
    throw new Error(sanitizeUserFacingErrorMessage(maybeResult.error.message, fallback));
  }

  if (maybeResult?.error) {
    throw new Error(fallback);
  }
}

export function useBetterAuthSession() {
  const sessionState = authClient.useSession();
  const [isTokenSyncing, setIsTokenSyncing] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isTokenReady, setIsTokenReady] = useState(false);
  const consecutiveRefreshFailuresRef = useRef(0);

  const delay = useCallback((ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms)), []);

  const fetchTokenWithRetry = useCallback(async (): Promise<string | null> => {
    for (let attempt = 0; attempt <= TOKEN_REFRESH_MAX_RETRIES; attempt += 1) {
      const token = await fetchConvexJwtToken();
      if (token) {
        return token;
      }

      if (attempt < TOKEN_REFRESH_MAX_RETRIES) {
        await delay(TOKEN_REFRESH_RETRY_DELAY_MS * (attempt + 1));
      }
    }

    return null;
  }, [delay]);

  const syncConvexToken = useCallback(async () => {
    if (!sessionState.data) {
      consecutiveRefreshFailuresRef.current = 0;
      clearConvexAuthToken();
      setIsTokenReady(false);
      return;
    }

    setIsTokenSyncing(true);
    try {
      const token = await fetchTokenWithRetry();
      if (!token) {
        throw new Error("Failed to fetch Better Auth JWT token for Convex.");
      }

      setConvexAuthToken(token);
      consecutiveRefreshFailuresRef.current = 0;
      setIsTokenReady(true);
      setAuthError(null);
    } catch (error) {
      consecutiveRefreshFailuresRef.current += 1;
      const hasExistingToken = hasConvexAuthToken();

      if (!hasExistingToken || consecutiveRefreshFailuresRef.current >= MAX_CONSECUTIVE_REFRESH_FAILURES) {
        clearConvexAuthToken();
        setIsTokenReady(false);
      } else {
        // Keep the previous token during transient refresh failures to avoid auth flapping.
        setIsTokenReady(true);
      }

      setAuthError(getErrorMessage(error, "Unable to sync auth token."));
    } finally {
      setIsTokenSyncing(false);
    }
  }, [fetchTokenWithRetry, sessionState.data]);

  useEffect(() => {
    if (sessionState.isPending) {
      return;
    }

    if (!sessionState.data) {
      clearConvexAuthToken();
      setIsTokenReady(false);
      return;
    }

    void syncConvexToken();
  }, [sessionState.data, sessionState.isPending, syncConvexToken]);

  useEffect(() => {
    if (!sessionState.data) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void syncConvexToken();
    }, TOKEN_REFRESH_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [sessionState.data, syncConvexToken]);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    setAuthError(null);

    try {
      const result = await authClient.signIn.email({
        email,
        password,
        rememberMe: true,
      });
      ensureNoAuthError(result, "Sign in failed.");
      await sessionState.refetch();
      await syncConvexToken();
    } catch (error) {
      setAuthError(getErrorMessage(error, "Sign in failed."));
      throw error;
    }
  }, [sessionState, syncConvexToken]);

  const signUpWithEmail = useCallback(async (name: string, email: string, password: string) => {
    setAuthError(null);

    try {
      const result = await authClient.signUp.email({
        name,
        email,
        password,
      });
      ensureNoAuthError(result, "Sign up failed.");
      await sessionState.refetch();
      await syncConvexToken();
    } catch (error) {
      setAuthError(getErrorMessage(error, "Sign up failed."));
      throw error;
    }
  }, [sessionState, syncConvexToken]);

  const signInWithOAuth = useCallback(async (provider: string) => {
    setAuthError(null);

    const callbackURL = typeof window !== "undefined" ? window.location.href : undefined;

    try {
      const result = await authClient.signIn.social({
        provider,
        callbackURL,
      });
      ensureNoAuthError(result, `OAuth sign in failed for provider ${provider}.`);

      // Some Better Auth client versions return a URL and expect the app to navigate manually.
      const maybeResult = result as {
        url?: unknown;
        data?: {
          url?: unknown;
        };
      };

      const redirectUrl =
        typeof maybeResult?.url === "string"
          ? maybeResult.url
          : typeof maybeResult?.data?.url === "string"
            ? maybeResult.data.url
            : null;

      if (redirectUrl && typeof window !== "undefined") {
        window.location.assign(redirectUrl);
      }
    } catch (error) {
      setAuthError(getErrorMessage(error, `OAuth sign in failed for provider ${provider}.`));
      throw error;
    }
  }, []);

  const signOut = useCallback(async () => {
    setAuthError(null);

    try {
      const result = await authClient.signOut();
      ensureNoAuthError(result, "Sign out failed.");
      await sessionState.refetch();
    } finally {
      clearConvexAuthToken();
      setIsTokenReady(false);
    }
  }, [sessionState]);

  const isAuthenticated = Boolean(sessionState.data);
  const isLoading = sessionState.isPending || isTokenSyncing;

  const sessionUser = useMemo(() => {
    if (!sessionState.data) {
      return null;
    }

    const user = (sessionState.data as { user?: Record<string, unknown> }).user;
    if (!user) {
      return null;
    }

    const name = typeof user.name === "string" ? user.name : "";
    const email = typeof user.email === "string" ? user.email : "";
    const image = typeof user.image === "string" ? user.image : null;

    return {
      name,
      email,
      image,
    };
  }, [sessionState.data]);

  return {
    isLoading,
    isAuthenticated,
    isTokenReady,
    authError,
    sessionUser,
    refreshSession: sessionState.refetch,
    signInWithEmail,
    signUpWithEmail,
    signInWithOAuth,
    signOut,
  };
}
