import { makeFunctionReference, type FunctionReference } from "convex/server";

type QueryRef = FunctionReference<"query", "public", Record<string, unknown>, unknown>;
type MutationRef = FunctionReference<"mutation", "public", Record<string, unknown>, unknown>;

export const convexRefs = {
  getBoard: makeFunctionReference<"query">("board:getBoard") as QueryRef,
  bootstrapDefaultBoard: makeFunctionReference<"mutation">("board:bootstrapDefaultBoard") as MutationRef,
  addColumn: makeFunctionReference<"mutation">("board:addColumn") as MutationRef,
  updateColumnTitle: makeFunctionReference<"mutation">("board:updateColumnTitle") as MutationRef,
  deleteColumn: makeFunctionReference<"mutation">("board:deleteColumn") as MutationRef,
  reorderColumns: makeFunctionReference<"mutation">("board:reorderColumns") as MutationRef,
  addTask: makeFunctionReference<"mutation">("board:addTask") as MutationRef,
  updateTaskContent: makeFunctionReference<"mutation">("board:updateTaskContent") as MutationRef,
  deleteTask: makeFunctionReference<"mutation">("board:deleteTask") as MutationRef,
  moveTask: makeFunctionReference<"mutation">("board:moveTask") as MutationRef,
  getCurrentUser: makeFunctionReference<"query">("users:getCurrentUser") as QueryRef,
  upsertCurrentUser: makeFunctionReference<"mutation">("users:upsertCurrentUser") as MutationRef,
  generateAvatarUploadUrl: makeFunctionReference<"mutation">("users:generateAvatarUploadUrl") as MutationRef,
  saveCurrentUserAvatar: makeFunctionReference<"mutation">("users:saveCurrentUserAvatar") as MutationRef,
};
