import { useEffect, useMemo, useRef, useState } from "react";
import { LogOut, Moon, Plus, RotateCcw, RotateCw, Sun, User, UserCircle2 } from "lucide-react";
import "./App.css";
import { BoardView } from "./features/board/BoardView";
import { AuthPanel } from "./features/auth/AuthPanel";
import { AccountProfilePage } from "./features/account/AccountProfilePage";
import { Button } from "./components/ui/Button";
import { Input } from "./components/ui/Input";
import { Modal } from "./components/ui/Modal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./components/ui/dropdown-menu";
import { useDarkMode } from "./hooks/useDarkMode";
import { useBetterAuthSession } from "./hooks/useBetterAuthSession";
import { getConfiguredOauthProviders } from "./lib/authClient";
import { getConvexClient } from "./lib/convexClient";
import { convexRefs } from "./lib/convexRefs";
import { useBoardStore } from "./store/boardStore";

function App() {
  const { isDark, toggle } = useDarkMode();
  const {
    isLoading: isAuthLoading,
    isAuthenticated,
    isTokenReady,
    authError,
    sessionUser,
    refreshSession,
    signInWithEmail,
    signUpWithEmail,
    signInWithOAuth,
    signOut,
  } = useBetterAuthSession();

  const [activeView, setActiveView] = useState<"board" | "profile">("board");

  const [isCreateColumnOpen, setIsCreateColumnOpen] = useState(false);
  const [columnTitle, setColumnTitle] = useState("");

  const addColumn = useBoardStore((state) => state.addColumn);
  const initializeFromRemote = useBoardStore((state) => state.initializeFromRemote);
  const resetForSignOut = useBoardStore((state) => state.resetForSignOut);
  const undo = useBoardStore((state) => state.undo);
  const redo = useBoardStore((state) => state.redo);
  const historyIndex = useBoardStore((state) => state.historyIndex);
  const historyLength = useBoardStore((state) => state.history.length);
  const tasks = useBoardStore((state) => state.tasks);
  const columns = useBoardStore((state) => state.columns);

  const taskCount = useMemo(() => Object.keys(tasks).length, [tasks]);
  const columnCount = useMemo(() => Object.keys(columns).length, [columns]);
  const previousColumnCountRef = useRef(columnCount);
  const oauthProviders = useMemo(() => getConfiguredOauthProviders(), []);
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const [convexAvatarUrl, setConvexAvatarUrl] = useState<string | null>(null);

  const resolvedSessionUser = useMemo(() => {
    if (!sessionUser) {
      return null;
    }

    return {
      ...sessionUser,
      image: convexAvatarUrl || sessionUser.image,
    };
  }, [convexAvatarUrl, sessionUser]);

  useEffect(() => {
    if (!isAuthenticated) {
      resetForSignOut();
      return;
    }

    if (!isTokenReady) {
      return;
    }

    void initializeFromRemote();
  }, [initializeFromRemote, isAuthenticated, isTokenReady, resetForSignOut]);

  useEffect(() => {
    if (!isAuthenticated || !isTokenReady || !sessionUser) {
      return;
    }

    const client = getConvexClient();
    if (!client) {
      return;
    }

    let cancelled = false;

    const upsertWithRetry = async () => {
      while (!cancelled) {
        try {
          await client.mutation(convexRefs.upsertCurrentUser, {
            name: sessionUser.name || undefined,
            avatarUrl: (convexAvatarUrl || sessionUser.image) || undefined,
          });
          return;
        } catch {
          // Keep this non-fatal for UX; retry in background.
          await new Promise((resolve) => window.setTimeout(resolve, 5000));
        }
      }
    };

    void upsertWithRetry();

    return () => {
      cancelled = true;
    };
  }, [convexAvatarUrl, isAuthenticated, isTokenReady, sessionUser]);

  useEffect(() => {
    if (!isAuthenticated || !isTokenReady) {
      setConvexAvatarUrl(null);
      return;
    }

    const client = getConvexClient();
    if (!client) {
      return;
    }

    let cancelled = false;

    const loadConvexAvatar = async () => {
      try {
        const currentUser = (await client.query(convexRefs.getCurrentUser, {})) as { image?: unknown } | null;
        if (cancelled) {
          return;
        }

        const nextAvatar = typeof currentUser?.image === "string" && currentUser.image.trim().length > 0
          ? currentUser.image
          : null;
        setConvexAvatarUrl(nextAvatar);
      } catch {
        if (!cancelled) {
          setConvexAvatarUrl((existing) => existing ?? null);
        }
      }
    };

    void loadConvexAvatar();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isTokenReady]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          redo();
          return;
        }
        undo();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [redo, undo]);

  useEffect(() => {
    const previousCount = previousColumnCountRef.current;
    const columnAdded = columnCount > previousCount;

    if (isCreateColumnOpen && columnAdded) {
      setIsCreateColumnOpen(false);
      setColumnTitle("");
    }

    previousColumnCountRef.current = columnCount;
  }, [columnCount, isCreateColumnOpen]);

  const submitColumn = () => {
    const title = columnTitle.trim();
    if (!title) return;

    addColumn(title);
    setColumnTitle("");
    setIsCreateColumnOpen(false);
  };

  const handleSignIn = async (email: string, password: string) => {
    setIsAuthSubmitting(true);
    try {
      await signInWithEmail(email, password);
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  const handleSignUp = async (name: string, email: string, password: string) => {
    setIsAuthSubmitting(true);
    try {
      await signUpWithEmail(name, email, password);
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  const handleOAuthSignIn = async (provider: string) => {
    setIsAuthSubmitting(true);
    try {
      await signInWithOAuth(provider);
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    resetForSignOut();
    setActiveView("board");
  };

  const backgroundClassName =
    "min-h-screen bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.18),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(236,72,153,0.12),transparent_35%),linear-gradient(180deg,#f8fafc_0%,#e2e8f0_100%)] text-slate-900 transition-colors dark:bg-[radial-gradient(circle_at_15%_15%,rgba(14,116,144,0.35),transparent_42%),radial-gradient(circle_at_85%_0%,rgba(126,34,206,0.2),transparent_35%),linear-gradient(180deg,#020617_0%,#111827_100%)] dark:text-slate-100";

  if (isAuthLoading || (isAuthenticated && !isTokenReady && !authError)) {
    return (
      <main className={`${backgroundClassName} flex items-center justify-center`}>
        <p className="rounded-xl border border-white/40 bg-white/75 px-5 py-3 text-sm font-medium shadow-lg backdrop-blur-md dark:border-slate-700/60 dark:bg-slate-900/75">
          Establishing secure session...
        </p>
      </main>
    );
  }

  if (isAuthenticated && !isTokenReady && authError) {
    return (
      <main className={`${backgroundClassName} flex items-center justify-center px-4`}>
        <div className="w-full max-w-md rounded-2xl border border-rose-300/60 bg-white/85 p-5 shadow-xl backdrop-blur-md dark:border-rose-500/40 dark:bg-slate-900/85">
          <p className="text-sm font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-300">Session Error</p>
          <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
            {authError}
          </p>
          <div className="mt-4 flex gap-2">
            <Button variant="secondary" onClick={() => window.location.reload()}>
              Retry
            </Button>
            <Button variant="danger" onClick={() => void handleSignOut()}>
              Sign Out
            </Button>
          </div>
        </div>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className={backgroundClassName}>
        <div className="mx-auto flex w-full max-w-7xl justify-end px-4 pt-6 md:px-8">
          <Button variant="secondary" size="icon" onClick={toggle} aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}>
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </Button>
        </div>
        <AuthPanel
          authError={authError}
          oauthProviders={oauthProviders}
          isSubmitting={isAuthSubmitting || isAuthLoading}
          onSignIn={handleSignIn}
          onSignUp={handleSignUp}
          onOAuthSignIn={handleOAuthSignIn}
        />
      </main>
    );
  }

  return (
    <main className={backgroundClassName}>
      <section className="w-full pb-8 pt-6 lg:pr-4">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <aside className="flex w-full flex-col gap-5 rounded-2xl border border-white/40 bg-white/75 p-4 shadow-xl backdrop-blur-md dark:border-slate-700/50 dark:bg-slate-900/70 lg:sticky lg:top-6 lg:w-72 lg:shrink-0 lg:border-l-0 lg:ml-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-cyan-300">Production Board</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight">Kanban Workspace</h1>
            </div>

            <div className="flex gap-1">
              <Button variant="secondary" size="icon" onClick={undo} disabled={historyIndex <= 0} aria-label="Undo">
                <RotateCcw size={16} />
              </Button>
              <Button variant="secondary" size="icon" onClick={redo} disabled={historyIndex >= historyLength - 1} aria-label="Redo">
                <RotateCw size={16} />
              </Button>
            </div>
              <Button onClick={() => setIsCreateColumnOpen(true)} className="justify-start gap-2">
                <Plus size={16} />
                Add Column
              </Button>
          </aside>

          <div className="min-w-0 flex-1 px-4 md:px-6 lg:px-2 xl:px-4">
            <div className="mb-4 flex justify-end gap-2">
              <Button variant="secondary" size="icon" onClick={toggle} aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}>
                {isDark ? <Sun size={18} /> : <Moon size={18} />}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Open account menu">
                    {resolvedSessionUser?.image ? (
                      <img
                        src={resolvedSessionUser.image}
                        alt="Profile"
                        className="h-8 w-8 rounded-full object-cover"
                      />
                    ) : (
                      <UserCircle2 size={20} />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Account</DropdownMenuLabel>
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{sessionUser?.name || "User"}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{sessionUser?.email || "No email"}</p>
                  </div>
                  <DropdownMenuSeparator />
                  {activeView !== "profile" ? (
                    <>
                      <DropdownMenuItem onSelect={() => setActiveView("profile")} className="gap-2">
                        <User size={16} />
                        Profile
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  ) : null}
                  <DropdownMenuItem onSelect={() => void handleSignOut()} className="gap-2 text-red-600 dark:text-red-300">
                    <LogOut size={16} />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {activeView === "board" ? (
              <>
                <header className="rounded-2xl border border-white/40 bg-white/75 p-5 shadow-xl backdrop-blur-md dark:border-slate-700/50 dark:bg-slate-900/70">
                  <div className="mb-5 text-left">
                    <p className="text-base font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Welcome back,</p>
                    <h2 className="text-3xl font-bold leading-tight text-slate-800 dark:text-slate-100 md:text-4xl">
                      {sessionUser?.name || "User"}
                    </h2>
                  </div>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                    <div className="rounded-lg border border-slate-200/80 bg-slate-50/80 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/70">
                      <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Tasks</p>
                      <p className="text-xl font-semibold">{taskCount}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200/80 bg-slate-50/80 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/70">
                      <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Columns</p>
                      <p className="text-xl font-semibold">{columnCount}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200/80 bg-slate-50/80 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/70">
                      <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">History</p>
                      <p className="text-xl font-semibold">{historyIndex + 1}</p>
                    </div>
                  </div>
                </header>

                <BoardView />
              </>
            ) : (
              <AccountProfilePage
                sessionUser={resolvedSessionUser}
                onBackToBoard={() => setActiveView("board")}
                onRefreshSession={refreshSession}
                onAvatarUpdated={(avatarUrl: string) => setConvexAvatarUrl(avatarUrl)}
                onAccountDeleted={() => {
                  resetForSignOut();
                  window.location.reload();
                }}
              />
            )}
          </div>
        </div>
      </section>

      <Modal
        open={isCreateColumnOpen}
        onClose={() => {
          setIsCreateColumnOpen(false);
          setColumnTitle("");
        }}
        title="Create Column"
        description="Add a new lane for your workflow."
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setIsCreateColumnOpen(false);
                setColumnTitle("");
              }}
            >
              Cancel
            </Button>
            <Button onClick={submitColumn} disabled={!columnTitle.trim()}>
              Add Column
            </Button>
          </>
        }
      >
        <Input
          label="Column Title"
          value={columnTitle}
          onChange={(event) => setColumnTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submitColumn();
            }
          }}
          placeholder="Example: QA Review"
          errorMessage={!columnTitle.trim() ? "A title is required" : undefined}
        />
      </Modal>
    </main>
  );
}

export default App;
