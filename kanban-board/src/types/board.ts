/** Unique identifier - using branded types for extra safety */
export type TaskId = string & { readonly brand: unique symbol };
export type ColumnId = string & { readonly brand: unique symbol };

/** Helper to create typed IDs */
export const createTaskId = (id: string): TaskId => id as TaskId;
export const createColumnId = (id: string): ColumnId => id as ColumnId;

export interface Task {
  id: TaskId;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  /** Optional fields for future features */
  labels?: string[];
  dueDate?: Date;
}

export interface Column {
  id: ColumnId;
  title: string;
  taskIds: TaskId[]; // Order matters! First = top of column
}

/**
 * Normalized state structure (like Redux recommends)
 * This prevents nested updates and makes lookups O(1)
 */
export interface BoardState {
  tasks: Record<TaskId, Task>;
  columns: Record<ColumnId, Column>;
  columnOrder: ColumnId[];
}

/**
 * Discriminated Union for Board Actions
 * (Apply your Day 4 EventBus learning here!)
 */
export type BoardAction =
  | { type: "ADD_TASK"; payload: { columnId: ColumnId; content: string } }
  | {
      type: "MOVE_TASK";
      payload: {
        taskId: TaskId;
        fromColumn: ColumnId;
        toColumn: ColumnId;
        toIndex: number;
      };
    }
  | { type: "DELETE_TASK"; payload: { taskId: TaskId; columnId: ColumnId } }
  | { type: "REORDER_COLUMN"; payload: { fromIndex: number; toIndex: number } }
  | { type: "ADD_COLUMN"; payload: { title: string } }
  | { type: "RENAME_COLUMN"; payload: { columnId: ColumnId; title: string } };