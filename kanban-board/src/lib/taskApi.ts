import type { Task } from "../types/board";

const NETWORK_DELAY_MS = 250;
const FAILURE_RATE = Number(import.meta.env.VITE_TASK_API_FAIL_RATE ?? "0");

export async function updateTaskRemote(task: Task): Promise<void> {
  // Mock remote update endpoint for local development.
  await new Promise<void>((resolve) => {
    setTimeout(() => resolve(), NETWORK_DELAY_MS);
  });

  if (Number.isFinite(FAILURE_RATE) && FAILURE_RATE > 0 && Math.random() < FAILURE_RATE) {
    throw new Error("Remote save failed");
  }

  void task;
}
