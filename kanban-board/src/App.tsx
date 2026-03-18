import { useState } from "react";
import "./App.css";
import { AutoTextarea } from "./components/ui/AutoTextarea";
import { Button } from "./components/ui/Button";
import { Card } from "./components/ui/Card";
import { IconButton } from "./components/ui/IconButton";
import { Input } from "./components/ui/Input";
import { Modal } from "./components/ui/Modal";
import { useDarkMode } from "./hooks/useDarkMode";

type LocalTask = {
  id: string;
  title: string;
  notes: string;
};

function App() {
  const { isDark, toggle } = useDarkMode();
  const [tasks, setTasks] = useState<LocalTask[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");

  const resetForm = () => {
    setTitle("");
    setNotes("");
  };

  const handleCreateTask = () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    setTasks((prev) => [
      {
        id: crypto.randomUUID(),
        title: trimmedTitle,
        notes: notes.trim(),
      },
      ...prev,
    ]);
    setIsCreateOpen(false);
    resetForm();
  };

  const deleteTask = (taskId: string) => {
    setTasks((prev) => prev.filter((task) => task.id !== taskId));
  };

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900 transition-colors dark:bg-slate-900 dark:text-slate-100 md:p-10">
      <section className="mx-auto w-full max-w-4xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Kanban Board UI Kit</h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Controlled inputs, composition with children, and local state in one place.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={toggle}>
              {isDark ? "Light" : "Dark"} Mode
            </Button>
            <Button onClick={() => setIsCreateOpen(true)}>Add Task</Button>
          </div>
        </header>

        <section aria-label="Task preview list" className="grid gap-3">
          {tasks.length === 0 ? (
            <Card>
              <p className="text-sm text-slate-600">No tasks yet. Add one to get started.</p>
            </Card>
          ) : (
            tasks.map((task) => (
              <Card key={task.id} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold text-slate-900">{task.title}</h2>
                  {task.notes ? <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{task.notes}</p> : null}
                </div>

                <IconButton
                  variant="danger"
                  size="sm"
                  label="Delete task"
                  onClick={() => deleteTask(task.id)}
                  icon={
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M3 6h18" />
                      <path d="M8 6V4h8v2" />
                      <path d="M6 6l1 14h10l1-14" />
                      <path d="M10 11v6" />
                      <path d="M14 11v6" />
                    </svg>
                  }
                />
              </Card>
            ))
          )}
        </section>
      </section>

      <Modal
        open={isCreateOpen}
        onClose={() => {
          setIsCreateOpen(false);
          resetForm();
        }}
        title="Create Task"
        description="Use controlled fields to capture title and details."
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setIsCreateOpen(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateTask} disabled={!title.trim()}>
              Save Task
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Title"
            placeholder="Enter task title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            errorMessage={!title.trim() ? "Title is required" : undefined}
          />

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="task-notes">
              Notes
            </label>
            <AutoTextarea
              id="task-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Optional details..."
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25"
            />
          </div>
        </div>
      </Modal>
    </main>
  );
}

export default App;
