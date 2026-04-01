import { useMemo, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";

type AuthMode = "sign-in" | "sign-up";

type AuthPanelProps = {
  authError: string | null;
  oauthProviders: string[];
  isSubmitting: boolean;
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (name: string, email: string, password: string) => Promise<void>;
  onOAuthSignIn: (provider: string) => Promise<void>;
};

function toProviderLabel(provider: string): string {
  if (!provider) {
    return "Provider";
  }

  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

export function AuthPanel({
  authError,
  oauthProviders,
  isSubmitting,
  onSignIn,
  onSignUp,
  onOAuthSignIn,
}: AuthPanelProps) {
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    if (!email.trim() || !password.trim()) {
      return false;
    }

    if (mode === "sign-up") {
      return name.trim().length >= 2;
    }

    return true;
  }, [email, mode, name, password]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLocalError(null);

    if (!canSubmit) {
      setLocalError("Please fill in all required fields.");
      return;
    }

    try {
      if (mode === "sign-up") {
        await onSignUp(name.trim(), email.trim(), password);
      } else {
        await onSignIn(email.trim(), password);
      }
    } catch {
      setLocalError(mode === "sign-up" ? "Sign up failed." : "Sign in failed.");
    }
  };

  return (
    <section className="mx-auto flex min-h-screen w-full max-w-7xl flex-col items-center justify-center gap-6 px-4 py-8 md:px-8">
      <Card className="w-full max-w-md border-white/50 bg-white/80 p-6 shadow-2xl backdrop-blur-md dark:border-slate-700/60 dark:bg-slate-900/80">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-cyan-300">Better Auth</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          {mode === "sign-up" ? "Create your account" : "Sign in to Kanban Workspace"}
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          {mode === "sign-up"
            ? "Use email/password or OAuth. JWT access tokens are synced to Convex automatically."
            : "Sign in to continue. Your board data is scoped to your authenticated account."}
        </p>

        <form className="mt-5 space-y-3" onSubmit={handleSubmit}>
          {mode === "sign-up" ? (
            <Input
              label="Name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
              placeholder="Jane Doe"
              required
            />
          ) : null}

          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            placeholder="you@example.com"
            required
          />

          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
            placeholder="••••••••"
            required
          />

          {authError ? <p className="text-sm font-medium text-rose-700 dark:text-rose-300">{authError}</p> : null}
          {localError ? <p className="text-sm font-medium text-rose-700 dark:text-rose-300">{localError}</p> : null}

          <Button type="submit" className="w-full" isLoading={isSubmitting} disabled={!canSubmit}>
            {mode === "sign-up" ? "Create account" : "Sign in"}
          </Button>
        </form>

        {oauthProviders.length > 0 ? (
          <div className="mt-4 space-y-2">
            {oauthProviders.map((provider) => (
              <Button
                key={provider}
                variant="secondary"
                className="w-full"
                onClick={async () => {
                  setLocalError(null);
                  try {
                    await onOAuthSignIn(provider);
                  } catch {
                    setLocalError(`OAuth sign in failed for ${toProviderLabel(provider)}.`);
                  }
                }}
                disabled={isSubmitting}
              >
                Continue with {toProviderLabel(provider)}
              </Button>
            ))}
          </div>
        ) : null}

        <div className="mt-5 text-sm text-slate-600 dark:text-slate-300">
          {mode === "sign-up" ? "Already have an account?" : "Need an account?"}{" "}
          <button
            type="button"
            className="font-semibold text-blue-600 hover:text-blue-500 dark:text-cyan-300 dark:hover:text-cyan-200"
            onClick={() => {
              setLocalError(null);
              setMode((current) => (current === "sign-up" ? "sign-in" : "sign-up"));
            }}
          >
            {mode === "sign-up" ? "Sign in" : "Sign up"}
          </button>
        </div>
      </Card>
    </section>
  );
}
