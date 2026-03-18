import { CSS } from "@dnd-kit/utilities";
import { useSortable } from "@dnd-kit/sortable";
import type { ColumnId, Task } from "../../types/board";
import { TaskCard } from "./TaskCard";

type SortableTaskCardProps = {
  task: Task;
  columnId: ColumnId;
  onDelete: () => void;
};

export function SortableTaskCard({ task, columnId, onDelete }: SortableTaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
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
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TaskCard task={task} isDragging={isDragging} onDelete={onDelete} />
    </div>
  );
}
