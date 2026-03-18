export class AsyncQueue {
  private readonly concurrency: number;
  private running = 0;
  private queue: Array<() => Promise<void>> = [];

  constructor(concurrency = 1) {
    this.concurrency = Math.max(1, concurrency);
  }

  add<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const run = async () => {
        this.running += 1;
        try {
          const result = await task();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.running -= 1;
          this.next();
        }
      };

      this.queue.push(run);
      this.next();
    });
  }

  private next() {
    if (this.running >= this.concurrency) return;

    const task = this.queue.shift();
    if (!task) return;

    void task();
  }
}
