import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useEffect, useMemo, useState } from "react";
import { Column } from "../../components/board/Column.tsx";
import { TaskCard } from "../../components/board/TaskCard.tsx";
import { Input } from "../../components/ui/Input";
import { useBoardStore } from "../../store/boardStore";
import type { Column as BoardColumn, ColumnId, Task, TaskId } from "../../types/board";

export function BoardView() {
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const tasks = useBoardStore((state) => state.tasks);
  const columns = useBoardStore((state) => state.columns);
  const columnOrder = useBoardStore((state) => state.columnOrder);
  const addColumn = useBoardStore((state) => state.addColumn);
  const addTask = useBoardStore((state) => state.addTask);
  const moveTask = useBoardStore((state) => state.moveTask);

  const filteredTasks = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const allTasks = Object.values(tasks);

    if (!normalizedQuery) {
      return allTasks;
    }

    return allTasks.filter((task) => task.content.toLowerCase().includes(normalizedQuery));
  }, [tasks, searchQuery]);

  const filteredTaskIds = useMemo(() => new Set(filteredTasks.map((task) => task.id)), [filteredTasks]);

  const columnData = useMemo(
    () =>
      columnOrder
        .map((columnId) => {
          const column = columns[columnId];
          if (!column) return null;

          const columnTasks = column.taskIds
            .filter((taskId) => (searchQuery.trim() ? filteredTaskIds.has(taskId) : true))
            .map((taskId) => tasks[taskId])
            .filter((task): task is Task => Boolean(task));

          return {
            columnId,
            column,
            columnTasks,
          };
        })
        .filter((item): item is { columnId: ColumnId; column: BoardColumn; columnTasks: Task[] } => item !== null),
      [columnOrder, columns, filteredTaskIds, searchQuery, tasks],
  );

  useEffect(() => {
    if (columnOrder.length === 0) {
      addColumn("To Do");
      addColumn("In Progress");
      addColumn("Done");
    }
  }, [addColumn, columnOrder.length]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const findTaskById = (taskId: TaskId): Task | null => tasks[taskId] ?? null;

  const findColumnById = (columnId: ColumnId): BoardColumn | null => columns[columnId] ?? null;

  const findColumnByTaskId = (taskId: TaskId): BoardColumn | null => {
    for (const column of Object.values(columns)) {
      if (column.taskIds.includes(taskId)) {
        return column;
      }
    }
    return null;
  };

  const moveTaskToColumn = (taskId: TaskId, from: ColumnId, to: ColumnId) => {
    const destination = columns[to];
    if (!destination) return;
    moveTask(taskId, from, to, destination.taskIds.length);
  };

  const reorderTask = (activeId: TaskId, overId: TaskId) => {
    const fromColumn = findColumnByTaskId(activeId);
    const overColumn = findColumnByTaskId(overId);
    if (!fromColumn || !overColumn) return;

    const toIndex = overColumn.taskIds.indexOf(overId);
    if (toIndex === -1) return;

    moveTask(activeId, fromColumn.id, overColumn.id, toIndex);
  };

  const handleDragStart = (event: DragStartEvent) => {
    const task = findTaskById(event.active.id as TaskId);
    setActiveTask(task);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as TaskId;
    const overId = over.id;

    const activeColumn = findColumnByTaskId(activeId);
    const overColumn = findColumnById(overId as ColumnId) || findColumnByTaskId(overId as TaskId);

    if (activeColumn && overColumn && activeColumn.id !== overColumn.id) {
      moveTaskToColumn(activeId, activeColumn.id, overColumn.id);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over || active.id === over.id) return;
    reorderTask(active.id as TaskId, over.id as TaskId);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="px-4 pt-4">
        <Input
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search tasks..."
          aria-label="Search tasks"
        />
      </div>

      <div className="flex gap-4 overflow-x-auto p-4">
        {columnData.map(({ columnId, column, columnTasks }) => (
          <Column
            key={columnId}
            column={column}
            tasks={columnTasks}
            onAddTask={(content) => addTask(column.id, content)}
          />
        ))}
      </div>

      <DragOverlay>{activeTask ? <TaskCard task={activeTask} isDragging /> : null}</DragOverlay>
    </DndContext>
  );
}