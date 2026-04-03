import { CSS } from "@dnd-kit/utilities";
import { useSortable } from "@dnd-kit/sortable";
import type { Column as BoardColumn, Task, TaskId, ColumnId } from "../../types/board";
import { Column } from "./Column";

type SortableColumnProps = {
  column: BoardColumn;
  tasks: Task[];
  onAddTask: (content: string) => void;
  onDeleteTask: (taskId: TaskId) => void;
  onDeleteColumn: () => void;
  onEditColumn?: (columnId: ColumnId, newTitle: string) => void;
};

export function SortableColumn({
  column,
  tasks,
  onAddTask,
  onDeleteTask,
  onDeleteColumn,
  onEditColumn,
}: SortableColumnProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: column.id,
    data: {
      type: "column",
      columnId: column.id,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.65 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <Column
        column={column}
        tasks={tasks}
        onAddTask={onAddTask}
        onDeleteTask={onDeleteTask}
        onDeleteColumn={onDeleteColumn}
        onEditColumn={onEditColumn}
        dragHandleProps={{ ...(attributes as React.ButtonHTMLAttributes<HTMLButtonElement>), ...(listeners ?? {}) }}
      />
    </div>
  );
}
