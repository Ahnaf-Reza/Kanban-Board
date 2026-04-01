import type { Task } from "../types/board";
import { getConvexClient } from "./convexClient";
import { convexRefs } from "./convexRefs";

export async function updateTaskRemote(task: Task): Promise<void> {
  const client = getConvexClient();
  if (!client) {
    throw new Error("VITE_CONVEX_URL is missing. Add it to .env.local.");
  }

  await client.mutation(convexRefs.updateTaskContent, {
    taskId: task.id,
    content: task.content,
  });
}
