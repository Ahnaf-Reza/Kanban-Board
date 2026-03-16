import { create } from "zustand";
import { persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import type { BoardState, ColumnId, Task, TaskId } from "../types/board";
import { toBoardState } from "../utils/boardGuards";

interface BoardStore extends BoardState {
  addTask: (columnId: ColumnId, content: string) => void;
  moveTask: (taskId: TaskId, from: ColumnId, to: ColumnId, toIndex: number) => void;
  updateTask: (taskId: TaskId, updates: Partial<Task>) => void;
  deleteTask: (taskId: TaskId, columnId: ColumnId) => void;
  addColumn: (title: string) => void;
  deleteColumn: (columnId: ColumnId) => void;
  reorderColumns: (fromIndex: number, toIndex: number) => void;
  history: BoardState[];
  historyIndex: number;
  undo: () => void;
  redo: () => void;
  pushToHistory: () => void;
}

const generateId = () => crypto.randomUUID();

export const useBoardStore = create<BoardStore>()(
  persist(
    immer((set, get) => ({
      tasks: {},
      columns: {},
      columnOrder: [],
      history: [],
      historyIndex: -1,

      addTask: (columnId, content) => {
        const taskId = generateId() as TaskId;
        set((state) => {
          const column = state.columns[columnId];
          if (!column) return;

          state.tasks[taskId] = {
            id: taskId,
            content,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          column.taskIds.push(taskId);
        });
        get().pushToHistory();
      },

      moveTask: (taskId, from, to, toIndex) => {
        set((state) => {
          const fromColumn = state.columns[from];
          const toColumn = state.columns[to];
          const task = state.tasks[taskId];
          if (!fromColumn || !toColumn || !task) return;

          const fromIndex = fromColumn.taskIds.indexOf(taskId);
          if (fromIndex === -1) return;

          fromColumn.taskIds.splice(fromIndex, 1);

          const safeIndex = Math.max(0, Math.min(toIndex, toColumn.taskIds.length));
          toColumn.taskIds.splice(safeIndex, 0, taskId);
          task.updatedAt = new Date();
        });
        get().pushToHistory();
      },

      updateTask: (taskId, updates) => {
        set((state) => {
          const task = state.tasks[taskId];
          if (!task) return;

          Object.assign(task, updates, { updatedAt: new Date() });
        });
        get().pushToHistory();
      },

      deleteTask: (taskId, columnId) => {
        set((state) => {
          const column = state.columns[columnId];
          if (!column) return;

          const index = column.taskIds.indexOf(taskId);
          if (index !== -1) {
            column.taskIds.splice(index, 1);
          }
          delete state.tasks[taskId];
        });
        get().pushToHistory();
      },

      addColumn: (title) => {
        const columnId = generateId() as ColumnId;
        set((state) => {
          state.columns[columnId] = {
            id: columnId,
            title,
            taskIds: [],
          };
          state.columnOrder.push(columnId);
        });
        get().pushToHistory();
      },

      deleteColumn: (columnId) => {
        set((state) => {
          const column = state.columns[columnId];
          if (!column) return;

          for (const taskId of column.taskIds) {
            delete state.tasks[taskId];
          }

          delete state.columns[columnId];
          state.columnOrder = state.columnOrder.filter((id) => id !== columnId);
        });
        get().pushToHistory();
      },

      reorderColumns: (fromIndex, toIndex) => {
        set((state) => {
          const { columnOrder } = state;
          if (
            fromIndex < 0 ||
            fromIndex >= columnOrder.length ||
            toIndex < 0 ||
            toIndex >= columnOrder.length
          ) {
            return;
          }

          const [moved] = columnOrder.splice(fromIndex, 1);
          columnOrder.splice(toIndex, 0, moved);
        });
        get().pushToHistory();
      },

      pushToHistory: () => {
        set((state) => {
          const snapshot: BoardState = {
            tasks: structuredClone(state.tasks),
            columns: structuredClone(state.columns),
            columnOrder: [...state.columnOrder],
          };

          state.history = state.history.slice(0, state.historyIndex + 1);
          state.history.push(snapshot);
          state.historyIndex = state.history.length - 1;
        });
      },

      undo: () => {
        const { history, historyIndex } = get();
        if (historyIndex <= 0) return;

        const previous = history[historyIndex - 1];
        set((state) => {
          state.tasks = structuredClone(previous.tasks);
          state.columns = structuredClone(previous.columns);
          state.columnOrder = [...previous.columnOrder];
          state.historyIndex = historyIndex - 1;
        });
      },

      redo: () => {
        const { history, historyIndex } = get();
        if (historyIndex >= history.length - 1) return;

        const next = history[historyIndex + 1];
        set((state) => {
          state.tasks = structuredClone(next.tasks);
          state.columns = structuredClone(next.columns);
          state.columnOrder = [...next.columnOrder];
          state.historyIndex = historyIndex + 1;
        });
      },
    })),
    {
      name: "kanban-board-storage",
      merge: (persistedState, currentState) => {
        const parsed = toBoardState(persistedState);
        if (!parsed) {
          return currentState;
        }

        return {
          ...currentState,
          tasks: parsed.tasks,
          columns: parsed.columns,
          columnOrder: parsed.columnOrder,
        };
      },
    },
  ),
);