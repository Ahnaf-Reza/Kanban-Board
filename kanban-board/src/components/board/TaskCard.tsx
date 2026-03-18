import { useState } from "react";
import { useDebouncedCallback } from "../../hooks/useDebounce";
import { useOptimisticUpdate } from "../../hooks/useOptimisticUpdate";
import { updateTaskRemote } from "../../lib/taskApi";
import { useBoardStore } from "../../store/boardStore";
import { AsyncQueue } from "../../utils/asyncQueue";
import type { Task } from "../../types/board";
import { AutoTextarea } from "../ui/AutoTextarea";
import { Card } from "../ui/Card";
import { IconButton } from "../ui/IconButton";

type TaskCardProps = {
  task: Task;
  isDragging?: boolean;
  onDelete?: () => void;
};

const saveQueue = new AsyncQueue(2);

export function TaskCard({ task, isDragging, onDelete }: TaskCardProps) {
  const updateTask = useBoardStore((state) => state.updateTask);
  const [content, setContent] = useState(task.content);

  const { mutate: saveTask, isLoading, error } = useOptimisticUpdate<string, string>(
    async (nextContent) => {
      const queuedTask: Task = {
        ...task,
        content: nextContent,
        updatedAt: new Date(),
      };

      await saveQueue.add(() => updateTaskRemote(queuedTask));
    },
    {
      onMutate: (nextContent) => {
        const current = useBoardStore.getState().tasks[task.id];
        const snapshot = current?.content ?? task.content;
        updateTask(task.id, { content: nextContent });
        return snapshot;
      },
      onError: (snapshot) => {
        setContent(snapshot);
        updateTask(task.id, { content: snapshot });
      },
    },
  );

  const statusMessage = error
    ? "Save failed. Rolled back to previous content."
    : isLoading
      ? "Saving..."
      : "Saved";

  const debouncedSave = useDebouncedCallback((nextContent: string) => {
    const trimmed = nextContent.trim();
    if (!trimmed) return;

    void saveTask(trimmed);
  }, 500);

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextValue = event.target.value;
    setContent(nextValue);
    debouncedSave(nextValue);
  };

  const handleSubmit = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      setContent(task.content);
      return;
    }

    setContent(trimmed);
    void saveTask(trimmed);
  };

  return (
    <Card isDragging={isDragging} className="cursor-grab active:cursor-grabbing dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-2">
        <AutoTextarea
          value={content}
          onChange={handleChange}
          onSubmit={handleSubmit}
          aria-label="Task content"
          className="w-full resize-none rounded border-0 bg-transparent p-0 text-sm text-slate-800 focus:ring-0 dark:text-slate-100"
        />

        {onDelete ? (
          <IconButton
            label="Delete task"
            variant="ghost"
            size="sm"
            onClick={(event) => {
              event.stopPropagation();
              onDelete();
            }}
            icon={
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path d="M3 6h18" />
                <path d="M8 6V4h8v2" />
                <path d="M6 6l1 14h10l1-14" />
                <path d="M10 11v6" />
                <path d="M14 11v6" />
              </svg>
            }
          />
        ) : null}
      </div>

      <p
        className="mt-2 text-xs text-slate-500 dark:text-slate-400"
        aria-live="polite"
      >
        {statusMessage}
      </p>
    </Card>
  );
}