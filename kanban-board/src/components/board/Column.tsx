import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Column as BoardColumn, Task } from "../../types/board";
import { AutoTextarea } from "../ui/AutoTextarea";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { TaskCard } from "./TaskCard";

type ColumnProps = {
  column: BoardColumn;
  tasks: Task[];
  onAddTask: (content: string) => void;
};

export function Column({ column, tasks, onAddTask }: ColumnProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [draft, setDraft] = useState("");

  const submit = () => {
    const content = draft.trim();
    if (!content) return;
    onAddTask(content);
    setDraft("");
    setIsCreating(false);
  };

  return (
    <section className="w-72 flex-shrink-0 space-y-3 rounded-xl bg-slate-100 p-3">
      <header className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">{column.title}</h2>
        <span className="rounded bg-slate-200 px-2 py-0.5 text-xs text-slate-600">{tasks.length}</span>
      </header>

      <div className="space-y-2">
        {tasks.length === 0 ? <Card className="text-sm text-slate-500">No tasks yet.</Card> : null}
        <AnimatePresence initial={false}>
          {tasks.map((task) => (
            <motion.div
              key={`${task.id}-${task.updatedAt.getTime()}`}
              layout
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.2 }}
            >
              <TaskCard task={task} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {isCreating ? (
        <Card>
          <AutoTextarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onSubmit={() => submit()}
            placeholder="Type a task and press Enter"
          />
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={submit} disabled={!draft.trim()}>
              Add
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setDraft("");
                setIsCreating(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </Card>
      ) : (
        <Button variant="ghost" className="w-full" onClick={() => setIsCreating(true)}>
          + Add Task
        </Button>
      )}
    </section>
  );
}