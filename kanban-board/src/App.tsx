import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import { BoardView } from "./features/board/BoardView";
import { Button } from "./components/ui/Button";
import { Input } from "./components/ui/Input";
import { Modal } from "./components/ui/Modal";
import { useDarkMode } from "./hooks/useDarkMode";
import { useBoardStore } from "./store/boardStore";

function App() {
  const { isDark, toggle } = useDarkMode();
  const [isCreateColumnOpen, setIsCreateColumnOpen] = useState(false);
  const [columnTitle, setColumnTitle] = useState("");

  const addColumn = useBoardStore((state) => state.addColumn);
  const undo = useBoardStore((state) => state.undo);
  const redo = useBoardStore((state) => state.redo);
  const historyIndex = useBoardStore((state) => state.historyIndex);
  const historyLength = useBoardStore((state) => state.history.length);
  const tasks = useBoardStore((state) => state.tasks);
  const columns = useBoardStore((state) => state.columns);

  const taskCount = useMemo(() => Object.keys(tasks).length, [tasks]);
  const columnCount = useMemo(() => Object.keys(columns).length, [columns]);
  const previousColumnCountRef = useRef(columnCount);

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

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.18),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(236,72,153,0.12),transparent_35%),linear-gradient(180deg,#f8fafc_0%,#e2e8f0_100%)] text-slate-900 transition-colors dark:bg-[radial-gradient(circle_at_15%_15%,rgba(14,116,144,0.35),transparent_42%),radial-gradient(circle_at_85%_0%,rgba(126,34,206,0.2),transparent_35%),linear-gradient(180deg,#020617_0%,#111827_100%)] dark:text-slate-100">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pb-8 pt-6 md:px-8">
        <header className="rounded-2xl border border-white/40 bg-white/75 p-5 shadow-xl backdrop-blur-md dark:border-slate-700/50 dark:bg-slate-900/70">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-cyan-300">Production Board</p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight">Kanban Workspace</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-700 dark:text-slate-300">
                Drag tasks across columns, edit inline with debounced autosave, and recover quickly with undo/redo.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" onClick={toggle}>
                {isDark ? "Light" : "Dark"} Mode
              </Button>
              <Button variant="ghost" onClick={undo} disabled={historyIndex <= 0}>
                Undo
              </Button>
              <Button variant="ghost" onClick={redo} disabled={historyIndex >= historyLength - 1}>
                Redo
              </Button>
              <Button onClick={() => setIsCreateColumnOpen(true)}>Add Column</Button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
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
