import type { BoardState, Column, ColumnId, Task, TaskId } from "../types/board";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const asDate = (value: unknown): Date | null => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return null;
};

const toTask = (value: unknown): Task | null => {
  if (!isRecord(value)) return null;

  const id = value.id;
  const content = value.content;
  const createdAt = asDate(value.createdAt);
  const updatedAt = asDate(value.updatedAt);
  const labels = value.labels;
  const dueDateRaw = value.dueDate;

  if (typeof id !== "string" || typeof content !== "string" || !createdAt || !updatedAt) {
    return null;
  }

  const dueDateCandidate = dueDateRaw === undefined ? undefined : asDate(dueDateRaw);
  if (dueDateRaw !== undefined && !dueDateCandidate) {
    return null;
  }

  if (labels !== undefined) {
    if (!Array.isArray(labels) || labels.some((label) => typeof label !== "string")) {
      return null;
    }
  }

  return {
    id: id as TaskId,
    content,
    createdAt,
    updatedAt,
    labels: labels as string[] | undefined,
    dueDate: dueDateCandidate ?? undefined,
  };
};

const toColumn = (value: unknown): Column | null => {
  if (!isRecord(value)) return null;

  const id = value.id;
  const title = value.title;
  const taskIds = value.taskIds;

  if (typeof id !== "string" || typeof title !== "string") {
    return null;
  }

  if (!Array.isArray(taskIds) || taskIds.some((taskId) => typeof taskId !== "string")) {
    return null;
  }

  return {
    id: id as ColumnId,
    title,
    taskIds: taskIds as TaskId[],
  };
};

export const toBoardState = (value: unknown): BoardState | null => {
  if (!isRecord(value)) return null;

  const rawTasks = value.tasks;
  const rawColumns = value.columns;
  const rawColumnOrder = value.columnOrder;

  if (!isRecord(rawTasks) || !isRecord(rawColumns) || !Array.isArray(rawColumnOrder)) {
    return null;
  }

  if (rawColumnOrder.some((columnId) => typeof columnId !== "string")) {
    return null;
  }

  const tasks: Record<TaskId, Task> = {};
  for (const [taskId, taskValue] of Object.entries(rawTasks)) {
    const parsedTask = toTask(taskValue);
    if (!parsedTask) return null;
    tasks[taskId as TaskId] = parsedTask;
  }

  const columns: Record<ColumnId, Column> = {};
  for (const [columnId, columnValue] of Object.entries(rawColumns)) {
    const parsedColumn = toColumn(columnValue);
    if (!parsedColumn) return null;
    columns[columnId as ColumnId] = parsedColumn;
  }

  return {
    tasks,
    columns,
    columnOrder: rawColumnOrder as ColumnId[],
  };
};

export const isValidBoardState = (value: unknown): value is BoardState => toBoardState(value) !== null;