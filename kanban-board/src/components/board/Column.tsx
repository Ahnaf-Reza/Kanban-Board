import { useEffect, useRef, useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { AnimatePresence, motion } from "framer-motion";
import type { Column as BoardColumn, Task } from "../../types/board";
import { AutoTextarea } from "../ui/AutoTextarea";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import type { TaskId } from "../../types/board";
import { SortableTaskCard } from "./SortableTaskCard";

type ColumnProps = {
  column: BoardColumn;
  tasks: Task[];
  onAddTask: (content: string) => void;
  onDeleteTask: (taskId: TaskId) => void;
  onDeleteColumn: () => void;
  dragHandleProps?: React.ButtonHTMLAttributes<HTMLButtonElement>;
};

export function Column({
  column,
  tasks,
  onAddTask,
  onDeleteTask,
  onDeleteColumn,
  dragHandleProps,
}: ColumnProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [draft, setDraft] = useState("");
  const previousTaskCountRef = useRef(tasks.length);
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  useEffect(() => {
    const previousCount = previousTaskCountRef.current;
    const taskAdded = tasks.length > previousCount;

    if (isCreating && taskAdded) {
      setDraft("");
      setIsCreating(false);
    }

    previousTaskCountRef.current = tasks.length;
  }, [isCreating, tasks.length]);

  const submit = (value?: string) => {
    const content = (value ?? draft).trim();
    if (!content) return;

    onAddTask(content);
    setDraft("");
    setIsCreating(false);
  };

  return (
    <section
      ref={setNodeRef}
      className="w-72 flex-shrink-0 space-y-3 rounded-xl border border-slate-200/70 bg-slate-100/80 p-3 shadow-sm backdrop-blur-sm transition-colors dark:border-slate-700/60 dark:bg-slate-800/70"
    >
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="cursor-grab rounded px-1.5 py-0.5 text-xs text-slate-500 hover:bg-slate-200 hover:text-slate-700 active:cursor-grabbing dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
            aria-label={`Drag column ${column.title}`}
            title="Drag column"
            {...dragHandleProps}
          >
            ::
          </button>
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{column.title}</h2>
        </div>
        <div className="flex items-center gap-1">
          <span className="rounded bg-slate-200 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-700 dark:text-slate-200">{tasks.length}</span>
          <Button
            size="sm"
            variant="ghost"
            className="px-2 text-xs text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-300 dark:hover:bg-red-950/40"
            onClick={onDeleteColumn}
          >
            Delete
          </Button>
        </div>
      </header>

      <SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {tasks.length === 0 ? (
            <Card className="text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              {isOver ? "Drop here" : "No tasks yet."}
            </Card>
          ) : null}
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
                <SortableTaskCard task={task} columnId={column.id} onDelete={() => onDeleteTask(task.id)} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </SortableContext>

      {isCreating ? (
        <Card>
          <AutoTextarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onSubmit={(value) => submit(value)}
            placeholder="Type a task and press Enter"
          />
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={() => submit()} disabled={!draft.trim()}>
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