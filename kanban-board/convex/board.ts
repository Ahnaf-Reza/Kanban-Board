import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { requireCurrentUserId } from "./auth";

const DEFAULT_BOARD_SLUG = "default";
const DEFAULT_BOARD_TITLE = "My Board";
const DEFAULT_COLUMNS = ["To Do", "In Progress", "Done"] as const;
const POSITION_GAP = 1024;

type TaskDoc = Doc<"tasks">;
type ConvexCtx = MutationCtx | QueryCtx;

async function getBoardByOwnerAndSlug(ctx: ConvexCtx, ownerId: string, slug: string) {
  return ctx.db
    .query("boards")
    .withIndex("by_ownerId_and_slug", (q) => q.eq("ownerId", ownerId).eq("slug", slug))
    .unique();
}

async function getColumnsByBoard(ctx: ConvexCtx, boardId: Id<"boards">) {
  return ctx.db
    .query("columns")
    .withIndex("by_board_position", (q) => q.eq("boardId", boardId))
    .collect();
}

async function getTasksByColumn(ctx: ConvexCtx, columnId: Id<"columns">) {
  return ctx.db
    .query("tasks")
    .withIndex("by_column_position", (q) => q.eq("columnId", columnId))
    .collect();
}

async function createDefaultBoard(ctx: MutationCtx) {
  const ownerId = await requireCurrentUserId(ctx);
  const now = Date.now();
  const boardId = await ctx.db.insert("boards", {
    slug: DEFAULT_BOARD_SLUG,
    title: DEFAULT_BOARD_TITLE,
    ownerId,
    createdAt: now,
    updatedAt: now,
  });

  for (let index = 0; index < DEFAULT_COLUMNS.length; index += 1) {
    await ctx.db.insert("columns", {
      boardId,
      title: DEFAULT_COLUMNS[index],
      position: index * POSITION_GAP,
      createdAt: now,
      updatedAt: now,
    });
  }

  return boardId;
}

async function requireOwnedBoard(
  ctx: ConvexCtx,
  boardId: Id<"boards">,
  ownerId: string,
): Promise<Doc<"boards">> {
  const board = await ctx.db.get(boardId);
  if (!board) {
    throw new Error("Board not found");
  }

  if (board.ownerId !== ownerId) {
    throw new Error("Forbidden");
  }

  return board;
}

async function requireOwnedColumn(
  ctx: ConvexCtx,
  columnId: Id<"columns">,
  ownerId: string,
): Promise<Doc<"columns">> {
  const column = await ctx.db.get(columnId);
  if (!column) {
    throw new Error("Column not found");
  }

  await requireOwnedBoard(ctx, column.boardId, ownerId);
  return column;
}

async function requireOwnedTask(
  ctx: ConvexCtx,
  taskId: Id<"tasks">,
  ownerId: string,
): Promise<Doc<"tasks">> {
  const task = await ctx.db.get(taskId);
  if (!task) {
    throw new Error("Task not found");
  }

  await requireOwnedBoard(ctx, task.boardId, ownerId);
  return task;
}

async function reindexColumns(ctx: MutationCtx, boardId: Id<"boards">) {
  const columns = await getColumnsByBoard(ctx, boardId);
  for (let index = 0; index < columns.length; index += 1) {
    await ctx.db.patch(columns[index]._id, { position: index * POSITION_GAP });
  }
}

async function reindexTasksInColumn(ctx: MutationCtx, columnId: Id<"columns">) {
  const tasks = await getTasksByColumn(ctx, columnId);
  for (let index = 0; index < tasks.length; index += 1) {
    await ctx.db.patch(tasks[index]._id, { position: index * POSITION_GAP });
  }
}

async function serializeBoard(ctx: QueryCtx, board: Doc<"boards">) {
  const columns = await getColumnsByBoard(ctx, board._id);
  const columnOrder = columns.map((column) => column._id);

  const tasksByColumn = new Map<Id<"columns">, TaskDoc[]>();
  for (const column of columns) {
    const tasks = await getTasksByColumn(ctx, column._id);
    tasksByColumn.set(column._id, tasks);
  }

  const tasks: Record<string, {
    id: string;
    content: string;
    createdAt: number;
    updatedAt: number;
  }> = {};

  const serializedColumns: Record<string, {
    id: string;
    title: string;
    taskIds: string[];
  }> = {};

  for (const column of columns) {
    const columnTasks = tasksByColumn.get(column._id) ?? [];
    const taskIds = columnTasks.map((task) => task._id);

    serializedColumns[column._id] = {
      id: column._id,
      title: column.title,
      taskIds,
    };

    for (const task of columnTasks) {
      tasks[task._id] = {
        id: task._id,
        content: task.content,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
      };
    }
  }

  return {
    board: {
      id: board._id,
      slug: board.slug,
      title: board.title,
      createdAt: board.createdAt,
      updatedAt: board.updatedAt,
    },
    state: {
      tasks,
      columns: serializedColumns,
      columnOrder,
    },
  };
}

export const bootstrapDefaultBoard = mutation({
  args: {},
  handler: async (ctx) => {
    const ownerId = await requireCurrentUserId(ctx);
    const existing = await getBoardByOwnerAndSlug(ctx, ownerId, DEFAULT_BOARD_SLUG);
    if (existing) {
      return existing._id;
    }

    return createDefaultBoard(ctx);
  },
});

export const getBoard = query({
  args: {
    slug: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const ownerId = await requireCurrentUserId(ctx);
    const slug = args.slug ?? DEFAULT_BOARD_SLUG;
    const board = await getBoardByOwnerAndSlug(ctx, ownerId, slug);
    if (!board) {
      return null;
    }

    return serializeBoard(ctx, board);
  },
});

export const addColumn = mutation({
  args: {
    boardId: v.id("boards"),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const ownerId = await requireCurrentUserId(ctx);
    await requireOwnedBoard(ctx, args.boardId, ownerId);

    const now = Date.now();
    const columns = await getColumnsByBoard(ctx, args.boardId);
    const nextPosition = columns.length * POSITION_GAP;

    const columnId = await ctx.db.insert("columns", {
      boardId: args.boardId,
      title: args.title,
      position: nextPosition,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.patch(args.boardId, { updatedAt: now });
    return columnId;
  },
});

export const updateColumnTitle = mutation({
  args: {
    columnId: v.id("columns"),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const ownerId = await requireCurrentUserId(ctx);
    const column = await requireOwnedColumn(ctx, args.columnId, ownerId);

    const now = Date.now();
    await ctx.db.patch(args.columnId, {
      title: args.title,
      updatedAt: now,
    });
    await ctx.db.patch(column.boardId, { updatedAt: now });
  },
});

export const deleteColumn = mutation({
  args: {
    columnId: v.id("columns"),
  },
  handler: async (ctx, args) => {
    const ownerId = await requireCurrentUserId(ctx);
    const column = await requireOwnedColumn(ctx, args.columnId, ownerId);

    const tasks = await getTasksByColumn(ctx, args.columnId);
    for (const task of tasks) {
      await ctx.db.delete(task._id);
    }

    await ctx.db.delete(args.columnId);
    await reindexColumns(ctx, column.boardId);
    await ctx.db.patch(column.boardId, { updatedAt: Date.now() });
  },
});

export const reorderColumns = mutation({
  args: {
    boardId: v.id("boards"),
    columnIds: v.array(v.id("columns")),
  },
  handler: async (ctx, args) => {
    const ownerId = await requireCurrentUserId(ctx);
    await requireOwnedBoard(ctx, args.boardId, ownerId);

    const columns = await getColumnsByBoard(ctx, args.boardId);
    const currentIds = new Set(columns.map((column) => column._id));

    if (args.columnIds.length !== columns.length) {
      throw new Error("columnIds length mismatch");
    }

    for (const columnId of args.columnIds) {
      if (!currentIds.has(columnId)) {
        throw new Error("columnIds must belong to the provided board");
      }
    }

    for (let index = 0; index < args.columnIds.length; index += 1) {
      await ctx.db.patch(args.columnIds[index], {
        position: index * POSITION_GAP,
      });
    }

    await ctx.db.patch(args.boardId, { updatedAt: Date.now() });
  },
});

export const addTask = mutation({
  args: {
    columnId: v.id("columns"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const ownerId = await requireCurrentUserId(ctx);
    const column = await requireOwnedColumn(ctx, args.columnId, ownerId);

    const now = Date.now();
    const tasks = await getTasksByColumn(ctx, args.columnId);
    const nextPosition = tasks.length * POSITION_GAP;

    const taskId = await ctx.db.insert("tasks", {
      boardId: column.boardId,
      columnId: args.columnId,
      content: args.content,
      position: nextPosition,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.patch(column.boardId, { updatedAt: now });
    return taskId;
  },
});

export const updateTaskContent = mutation({
  args: {
    taskId: v.id("tasks"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const ownerId = await requireCurrentUserId(ctx);
    const task = await requireOwnedTask(ctx, args.taskId, ownerId);

    const now = Date.now();
    await ctx.db.patch(args.taskId, {
      content: args.content,
      updatedAt: now,
    });
    await ctx.db.patch(task.boardId, { updatedAt: now });
  },
});

export const deleteTask = mutation({
  args: {
    taskId: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    const ownerId = await requireCurrentUserId(ctx);
    const task = await requireOwnedTask(ctx, args.taskId, ownerId);

    await ctx.db.delete(args.taskId);
    await reindexTasksInColumn(ctx, task.columnId);
    await ctx.db.patch(task.boardId, { updatedAt: Date.now() });
  },
});

export const moveTask = mutation({
  args: {
    taskId: v.id("tasks"),
    toColumnId: v.id("columns"),
    toIndex: v.number(),
  },
  handler: async (ctx, args) => {
    const ownerId = await requireCurrentUserId(ctx);
    const task = await requireOwnedTask(ctx, args.taskId, ownerId);

    const targetColumn = await requireOwnedColumn(ctx, args.toColumnId, ownerId);

    if (task.boardId !== targetColumn.boardId) {
      throw new Error("Cannot move task across boards");
    }

    const sourceColumnId = task.columnId;
    const now = Date.now();

    const sourceTasks = await getTasksByColumn(ctx, sourceColumnId);
    const targetTasks =
      sourceColumnId === args.toColumnId
        ? sourceTasks
        : await getTasksByColumn(ctx, args.toColumnId);

    const withoutTask = targetTasks.filter((candidate) => candidate._id !== args.taskId);
    const insertionIndex = Math.max(0, Math.min(args.toIndex, withoutTask.length));

    const reorderedTarget = [
      ...withoutTask.slice(0, insertionIndex),
      { ...task, columnId: args.toColumnId },
      ...withoutTask.slice(insertionIndex),
    ];

    for (let index = 0; index < reorderedTarget.length; index += 1) {
      const item = reorderedTarget[index];
      await ctx.db.patch(item._id, {
        columnId: args.toColumnId,
        position: index * POSITION_GAP,
        updatedAt: item._id === args.taskId ? now : item.updatedAt,
      });
    }

    if (sourceColumnId !== args.toColumnId) {
      const reorderedSource = sourceTasks.filter((candidate) => candidate._id !== args.taskId);
      for (let index = 0; index < reorderedSource.length; index += 1) {
        await ctx.db.patch(reorderedSource[index]._id, {
          position: index * POSITION_GAP,
        });
      }
    }

    await ctx.db.patch(task.boardId, { updatedAt: now });
  },
});
