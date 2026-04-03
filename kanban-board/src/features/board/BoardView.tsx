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
import { SortableContext, horizontalListSortingStrategy, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { SortableColumn } from "../../components/board/SortableColumn";
import { TaskCard } from "../../components/board/TaskCard.tsx";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { useBoardStore } from "../../store/boardStore";
import type { Column as BoardColumn, ColumnId, Task, TaskId } from "../../types/board";

export function BoardView() {
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [pendingColumnDelete, setPendingColumnDelete] = useState<{ id: ColumnId; title: string } | null>(null);
  const seenColumnIdsRef = useRef<Set<string>>(new Set());

  const tasks = useBoardStore((state) => state.tasks);
  const columns = useBoardStore((state) => state.columns);
  const columnOrder = useBoardStore((state) => state.columnOrder);
  const addTask = useBoardStore((state) => state.addTask);
  const moveTask = useBoardStore((state) => state.moveTask);
  const deleteTask = useBoardStore((state) => state.deleteTask);
  const renameColumn = useBoardStore((state) => state.renameColumn);
  const deleteColumn = useBoardStore((state) => state.deleteColumn);
  const reorderColumns = useBoardStore((state) => state.reorderColumns);

  const filteredTasks = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const allTasks = Object.values(tasks);

    if (!normalizedQuery) {
      return allTasks;
    }

    return allTasks.filter((task) => task.content.toLowerCase().includes(normalizedQuery));
  }, [tasks, searchQuery]);

  const filteredTaskIds = useMemo(() => new Set(filteredTasks.map((task) => task.id)), [filteredTasks]);
  const normalizedQuery = useMemo(() => searchQuery.trim().toLowerCase(), [searchQuery]);

  const columnData = useMemo(
    () =>
      columnOrder
        .map((columnId) => {
          const column = columns[columnId];
          if (!column) return null;

          const columnMatchesQuery = normalizedQuery.length > 0 && column.title.toLowerCase().includes(normalizedQuery);
          const columnTasks = column.taskIds
            .filter((taskId) => {
              if (!normalizedQuery) {
                return true;
              }

              // If the query matches the column title, show all tasks in that column.
              if (columnMatchesQuery) {
                return true;
              }

              return filteredTaskIds.has(taskId);
            })
            .map((taskId) => tasks[taskId])
            .filter((task): task is Task => Boolean(task));

          if (normalizedQuery && columnTasks.length === 0 && !columnMatchesQuery) {
            return null;
          }

          return {
            columnId,
            column,
            columnTasks,
          };
        })
        .filter((item): item is { columnId: ColumnId; column: BoardColumn; columnTasks: Task[] } => item !== null),
      [columnOrder, columns, filteredTaskIds, normalizedQuery, tasks],
  );

  useEffect(() => {
    for (const item of columnData) {
      seenColumnIdsRef.current.add(item.columnId);
    }
  }, [columnData]);

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

  const handleDragOver = (_event: DragOverEvent) => {
    void _event;
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const activeType = active.data.current?.type as "task" | "column" | undefined;
    const overType = over.data.current?.type as "task" | "column" | undefined;

    if (activeType === "column" && overType === "column") {
      if (active.id === over.id) return;

      const fromIndex = columnOrder.indexOf(active.id as ColumnId);
      const toIndex = columnOrder.indexOf(over.id as ColumnId);
      if (fromIndex === -1 || toIndex === -1) return;

      reorderColumns(fromIndex, toIndex);
      return;
    }

    if (activeType !== "task") return;

    if (overType === "task") {
      if (active.id === over.id) return;
      reorderTask(active.id as TaskId, over.id as TaskId);
      return;
    }

    if (overType === "column") {
      const taskId = active.id as TaskId;
      const fromColumn = findColumnByTaskId(taskId);
      const toColumn = findColumnById(over.id as ColumnId);
      if (!fromColumn || !toColumn) return;

      moveTask(taskId, fromColumn.id, toColumn.id, toColumn.taskIds.length);
    }
  };

  const confirmDeleteColumn = () => {
    if (!pendingColumnDelete) return;
    deleteColumn(pendingColumnDelete.id);
    setPendingColumnDelete(null);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="px-2 pt-4 md:px-3">
        <Input
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search tasks..."
          aria-label="Search tasks"
        />
      </div>

      <SortableContext items={columnData.map((item) => item.columnId)} strategy={horizontalListSortingStrategy}>
        <div className="flex gap-4 overflow-x-auto px-2 pb-4 pt-4 md:px-3">
          <AnimatePresence initial={false}>
            {columnData.map(({ columnId, column, columnTasks }) => (
              <motion.div
                key={columnId}
                initial={seenColumnIdsRef.current.has(columnId) ? false : { opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.22 }}
              >
                <SortableColumn
                  column={column}
                  tasks={columnTasks}
                  onAddTask={(content) => addTask(column.id, content)}
                  onRenameColumn={(title) => renameColumn(column.id, title)}
                  onDeleteTask={(taskId) => deleteTask(taskId, column.id)}
                  onDeleteColumn={() => setPendingColumnDelete({ id: column.id, title: column.title })}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </SortableContext>

      <DragOverlay>{activeTask ? <TaskCard task={activeTask} isDragging /> : null}</DragOverlay>

      <Modal
        open={pendingColumnDelete !== null}
        onClose={() => setPendingColumnDelete(null)}
        title="Delete Column"
        description="This action cannot be undone and will remove all tasks in the column."
        footer={
          <>
            <Button variant="secondary" onClick={() => setPendingColumnDelete(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmDeleteColumn}>
              Delete Column
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {pendingColumnDelete
            ? `Are you sure you want to delete "${pendingColumnDelete.title}"?`
            : "Are you sure you want to delete this column?"}
        </p>
      </Modal>
    </DndContext>
  );
}