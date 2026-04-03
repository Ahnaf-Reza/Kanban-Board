import { CSS } from "@dnd-kit/utilities";
import { useSortable } from "@dnd-kit/sortable";
import { useState } from "react";
import type { Column as BoardColumn, Task, TaskId } from "../../types/board";
import { Column } from "./Column";

type SortableColumnProps = {
  column: BoardColumn;
  tasks: Task[];
  onAddTask: (content: string) => void;
  onRenameColumn: (title: string) => void;
  onDeleteTask: (taskId: TaskId) => void;
  onDeleteColumn: () => void;
};

export function SortableColumn({
  column,
  tasks,
  onAddTask,
  onRenameColumn,
  onDeleteTask,
  onDeleteColumn,
}: SortableColumnProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: column.id,
    disabled: isEditingTitle,
    transition: {
      duration: 220,
      easing: "cubic-bezier(0.18, 0.89, 0.32, 1.08)",
    },
    data: {
      type: "column",
      columnId: column.id,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? undefined : transition,
    opacity: 1,
    willChange: "transform",
  };

  return (
    <div ref={setNodeRef} style={style}>
      <Column
        column={column}
        tasks={tasks}
        onAddTask={onAddTask}
        onRenameColumn={onRenameColumn}
        onTitleEditingChange={setIsEditingTitle}
        onDeleteTask={onDeleteTask}
        onDeleteColumn={onDeleteColumn}
        dragHandleProps={{ ...(attributes as React.ButtonHTMLAttributes<HTMLButtonElement>), ...(listeners ?? {}) }}
      />
    </div>
  );
}
