import { create } from "zustand";
import { persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { current } from "immer";
import type { BoardState, ColumnId, Task, TaskId } from "../types/board";
import { toBoardState } from "../utils/boardGuards";
import { getConvexClient, setConvexAuthToken } from "../lib/convexClient";
import { convexRefs } from "../lib/convexRefs";
import { fetchConvexJwtToken } from "../lib/authClient";

interface BoardStore extends BoardState {
  boardId: string | null;
  isRemoteLoading: boolean;
  remoteError: string | null;
  initializeFromRemote: () => Promise<void>;
  resetForSignOut: () => void;
  addTask: (columnId: ColumnId, content: string) => void;
  moveTask: (taskId: TaskId, from: ColumnId, to: ColumnId, toIndex: number) => void;
  updateTask: (taskId: TaskId, updates: Partial<Task>) => void;
  deleteTask: (taskId: TaskId, columnId: ColumnId) => void;
  addColumn: (title: string) => void;
  renameColumn: (columnId: ColumnId, title: string) => void;
  deleteColumn: (columnId: ColumnId) => void;
  reorderColumns: (fromIndex: number, toIndex: number) => void;
  history: BoardState[];
  historyIndex: number;
  undo: () => void;
  redo: () => void;
  pushToHistory: () => void;
}

const createSnapshot = (state: BoardState): BoardState => ({
  tasks: structuredClone(state.tasks),
  columns: structuredClone(state.columns),
  columnOrder: [...state.columnOrder],
});

type RemoteBoardData = {
  board: {
    id: string;
    slug: string;
    title: string;
    createdAt: number;
    updatedAt: number;
  };
  state: {
    tasks: Record<
      string,
      {
        id: string;
        content: string;
        createdAt: number;
        updatedAt: number;
      }
    >;
    columns: Record<
      string,
      {
        id: string;
        title: string;
        taskIds: string[];
      }
    >;
    columnOrder: string[];
  };
};

const toLocalState = (remote: RemoteBoardData): BoardState => {
  const tasks: Record<TaskId, Task> = {};
  for (const [taskId, task] of Object.entries(remote.state.tasks)) {
    tasks[taskId as TaskId] = {
      id: task.id as TaskId,
      content: task.content,
      createdAt: new Date(task.createdAt),
      updatedAt: new Date(task.updatedAt),
    };
  }

  const columns: BoardState["columns"] = {};
  for (const [columnId, column] of Object.entries(remote.state.columns)) {
    columns[columnId as ColumnId] = {
      id: column.id as ColumnId,
      title: column.title,
      taskIds: column.taskIds as TaskId[],
    };
  }

  return {
    tasks,
    columns,
    columnOrder: remote.state.columnOrder as ColumnId[],
  };
};

const initialBoardState: BoardState = {
  tasks: {},
  columns: {},
  columnOrder: [],
};

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && typeof error.message === "string" && error.message.trim().length > 0) {
    return error.message;
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return error;
  }

  try {
    const serialized = JSON.stringify(error);
    if (serialized && serialized !== "{}") {
      return serialized;
    }
  } catch {
    // Ignore serialization issues and return fallback.
  }

  return fallback;
}

function isUnauthorizedError(error: unknown): boolean {
  const message = toErrorMessage(error, "").toLowerCase();
  return (
    message.includes("unauthorized") ||
    message.includes("not authenticated") ||
    message.includes("invalid auth")
  );
}

async function refreshConvexTokenIfPossible(): Promise<boolean> {
  try {
    const token = await fetchConvexJwtToken();
    if (!token) {
      return false;
    }

    setConvexAuthToken(token);
    return true;
  } catch {
    return false;
  }
}

async function runWithAuthRetry<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!isUnauthorizedError(error)) {
      throw error;
    }

    const refreshed = await refreshConvexTokenIfPossible();
    if (!refreshed) {
      throw error;
    }

    return operation();
  }
}

export const useBoardStore = create<BoardStore>()(
  persist(
    immer((set, get) => {
      const syncFromRemote = async (showLoading = false) => {
        const client = getConvexClient();
        if (!client) {
          set((state) => {
            state.remoteError = "VITE_CONVEX_URL is missing. Add it to .env.local.";
            state.isRemoteLoading = false;
          });
          return;
        }

        if (showLoading) {
          set((state) => {
            state.isRemoteLoading = true;
            state.remoteError = null;
          });
        } else {
          set((state) => {
            state.remoteError = null;
          });
        }

        try {
          const boardId = (await runWithAuthRetry(
            async () => (await client.mutation(convexRefs.bootstrapDefaultBoard, {})) as string,
          )) as string;
          const remote = (await runWithAuthRetry(
            async () =>
              (await client.query(convexRefs.getBoard, {
                slug: "default",
              })) as RemoteBoardData | null,
          )) as RemoteBoardData | null;

          if (!remote) {
            throw new Error("Board not found after bootstrap");
          }

          const parsed = toLocalState(remote);
          set((state) => {
            state.tasks = parsed.tasks;
            state.columns = parsed.columns;
            state.columnOrder = parsed.columnOrder;
            state.boardId = boardId;
            state.history = [createSnapshot(parsed)];
            state.historyIndex = 0;
            state.isRemoteLoading = false;
          });
        } catch (error) {
          const message = toErrorMessage(error, "Failed to sync board");
          set((state) => {
            state.remoteError = message;
            state.isRemoteLoading = false;
          });
        }
      };

      return {
        ...initialBoardState,
        boardId: null,
        isRemoteLoading: false,
        remoteError: null,
        history: [createSnapshot(initialBoardState)],
        historyIndex: 0,

        initializeFromRemote: async () => {
          await syncFromRemote(true);
        },

        resetForSignOut: () => {
          set((state) => {
            state.tasks = {};
            state.columns = {};
            state.columnOrder = [];
            state.boardId = null;
            state.isRemoteLoading = false;
            state.remoteError = null;
            state.history = [createSnapshot(initialBoardState)];
            state.historyIndex = 0;
          });
        },

      addTask: (columnId, content) => {
        const nextContent = content.trim();
        if (!nextContent) {
          return;
        }

        const client = getConvexClient();
        if (!client) return;

        void (async () => {
          try {
            const createdTaskId = (await runWithAuthRetry(async () =>
              client.mutation(convexRefs.addTask, {
                columnId,
                content: nextContent,
              }),
            )) as string;

            set((state) => {
              const column = state.columns[columnId];
              if (!column) return;

              const now = new Date();
              const taskId = createdTaskId as TaskId;

              state.tasks[taskId] = {
                id: taskId,
                content: nextContent,
                createdAt: now,
                updatedAt: now,
              };
              column.taskIds.push(taskId);
            });
            get().pushToHistory();
          } catch (error) {
            const message = toErrorMessage(error, "Failed to add task");
            set((state) => {
              state.remoteError = message;
            });
            await syncFromRemote(false);
          }
        })();
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

        const client = getConvexClient();
        if (!client) return;

        void (async () => {
          try {
            await runWithAuthRetry(async () =>
              client.mutation(convexRefs.moveTask, {
                taskId,
                toColumnId: to,
                toIndex,
              }),
            );
          } catch (error) {
            const message = toErrorMessage(error, "Failed to move task");
            set((state) => {
              state.remoteError = message;
            });
            await syncFromRemote();
          }
        })();
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

        const client = getConvexClient();
        if (!client) return;

        void (async () => {
          try {
            await runWithAuthRetry(async () =>
              client.mutation(convexRefs.deleteTask, {
                taskId,
              }),
            );
          } catch (error) {
            const message = toErrorMessage(error, "Failed to delete task");
            set((state) => {
              state.remoteError = message;
            });
            await syncFromRemote();
          }
        })();
      },

      addColumn: (title) => {
        const nextTitle = title.trim();
        if (!nextTitle) {
          return;
        }

        const client = getConvexClient();
        const boardId = get().boardId;
        if (!client || !boardId) return;

        void (async () => {
          try {
            const createdColumnId = (await runWithAuthRetry(async () =>
              client.mutation(convexRefs.addColumn, {
                boardId,
                title: nextTitle,
              }),
            )) as string;

            set((state) => {
              const columnId = createdColumnId as ColumnId;
              state.columns[columnId] = {
                id: columnId,
                title: nextTitle,
                taskIds: [],
              };
              state.columnOrder.push(columnId);
            });
            get().pushToHistory();
          } catch (error) {
            const message = toErrorMessage(error, "Failed to add column");
            set((state) => {
              state.remoteError = message;
            });
            await syncFromRemote(false);
          }
        })();
      },

      renameColumn: (columnId, title) => {
        const nextTitle = title.trim();
        if (!nextTitle) {
          return;
        }

        const previousTitle = get().columns[columnId]?.title;
        if (!previousTitle || previousTitle === nextTitle) {
          return;
        }

        set((state) => {
          const column = state.columns[columnId];
          if (!column) return;
          column.title = nextTitle;
        });
        get().pushToHistory();

        const client = getConvexClient();
        if (!client) return;

        void (async () => {
          try {
            await runWithAuthRetry(async () =>
              client.mutation(convexRefs.updateColumnTitle, {
                columnId,
                title: nextTitle,
              }),
            );
          } catch (error) {
            const message = toErrorMessage(error, "Failed to rename column");
            set((state) => {
              state.remoteError = message;
            });
            await syncFromRemote(false);
          }
        })();
      },

      deleteColumn: (columnId) => {
        const client = getConvexClient();
        if (!client) return;

        const existingColumn = get().columns[columnId];
        if (!existingColumn) {
          return;
        }

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

        void (async () => {
          try {
            await runWithAuthRetry(async () =>
              client.mutation(convexRefs.deleteColumn, {
                columnId,
              }),
            );
          } catch (error) {
            const message = toErrorMessage(error, "Failed to delete column");
            set((state) => {
              state.remoteError = message;
            });
            await syncFromRemote(false);
          }
        })();
      },

      reorderColumns: (fromIndex, toIndex) => {
        const boardId = get().boardId;
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

        if (!boardId) return;

        const client = getConvexClient();
        if (!client) return;

        const nextOrder = [...get().columnOrder];

        void (async () => {
          try {
            await runWithAuthRetry(async () =>
              client.mutation(convexRefs.reorderColumns, {
                boardId,
                columnIds: nextOrder,
              }),
            );
          } catch (error) {
            const message = toErrorMessage(error, "Failed to reorder columns");
            set((state) => {
              state.remoteError = message;
            });
            await syncFromRemote();
          }
        })();
      },

      pushToHistory: () => {
        set((state) => {
          const plainState = current(state);
          const snapshot = createSnapshot(plainState);

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
    };
    }),
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
          boardId: null,
          isRemoteLoading: false,
          remoteError: null,
          history: [createSnapshot(parsed)],
          historyIndex: 0,
        };
      },
    },
  ),
);