import { useState } from "react";
import { Check, Pencil } from "lucide-react";
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
  onEditingChange?: (isEditing: boolean) => void;
};

const saveQueue = new AsyncQueue(2);

export function TaskCard({ task, isDragging, onDelete, onEditingChange }: TaskCardProps) {
  const updateTask = useBoardStore((state) => state.updateTask);
  const [content, setContent] = useState(task.content);
  const [isEditing, setIsEditing] = useState(false);

  const setEditingState = (next: boolean) => {
    setIsEditing(next);
    onEditingChange?.(next);
  };

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
      : null;

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
    setEditingState(false);
  };

  return (
    <Card isDragging={isDragging} className="cursor-grab active:cursor-grabbing dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-2">
        {isEditing ? (
          <AutoTextarea
            value={content}
            onChange={handleChange}
            onSubmit={handleSubmit}
            onBlur={() => setEditingState(false)}
            autoFocus
            aria-label="Task content"
            className="w-full resize-none rounded border-0 bg-transparent p-0 text-sm text-slate-800 focus:ring-0 dark:text-slate-100"
          />
        ) : (
          <p className="w-full whitespace-pre-wrap break-words text-sm text-slate-800 dark:text-slate-100">{content}</p>
        )}

        {onDelete ? (
          <IconButton
            label="Delete task"
            variant="ghost"
            size="sm"
            className={isEditing
              ? "text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-300 dark:hover:bg-red-950/40"
              : "text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"}
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

      <div className="mt-2 flex items-center justify-between">
        <p className="text-xs text-slate-500 dark:text-slate-400" aria-live="polite">
          {statusMessage}
        </p>
        <IconButton
          label={isEditing ? "Confirm task edit" : "Edit task"}
          variant="ghost"
          size="sm"
          className={isEditing
            ? "text-green-600 hover:bg-green-50 hover:text-green-700 dark:text-green-300 dark:hover:bg-green-950/40"
            : "text-slate-600 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"}
          onClick={(event) => {
            event.stopPropagation();
            if (isEditing) {
              handleSubmit(content);
              return;
            }
            setEditingState(true);
          }}
          icon={isEditing ? <Check className="h-4 w-4" aria-hidden="true" /> : <Pencil className="h-4 w-4" aria-hidden="true" />}
        />
      </div>
    </Card>
  );
}