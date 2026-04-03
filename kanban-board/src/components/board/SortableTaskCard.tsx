import { CSS } from "@dnd-kit/utilities";
import { useSortable } from "@dnd-kit/sortable";
import { useState } from "react";
import type { ColumnId, Task } from "../../types/board";
import { TaskCard } from "./TaskCard";

type SortableTaskCardProps = {
  task: Task;
  columnId: ColumnId;
  onDelete: () => void;
};

export function SortableTaskCard({ task, columnId, onDelete }: SortableTaskCardProps) {
  const [isEditing, setIsEditing] = useState(false);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled: isEditing,
    data: {
      type: "task",
      taskId: task.id,
      columnId,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={isEditing ? undefined : "touch-none select-none"}
      {...attributes}
      {...listeners}
    >
      <TaskCard
        task={task}
        isDragging={isDragging}
        onDelete={onDelete}
        onEditingChange={setIsEditing}
      />
    </div>
  );
}
