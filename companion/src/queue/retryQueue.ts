import fs from "node:fs/promises";
import path from "node:path";

export interface QueuedCapture {
  idempotencyKey: string;
  payload: Record<string, unknown>;
  attempts: number;
  nextAttemptAt: number;
  lastError: string | null;
  createdAt: number;
}

interface QueueState {
  items: QueuedCapture[];
}

const DEFAULT_STATE: QueueState = { items: [] };

export class RetryQueue {
  private readonly queueFile: string;
  private state: QueueState = DEFAULT_STATE;

  constructor(queueDir: string) {
    this.queueFile = path.join(queueDir, "capture-queue.json");
  }

  async init(): Promise<void> {
    await fs.mkdir(path.dirname(this.queueFile), { recursive: true });
    try {
      const raw = await fs.readFile(this.queueFile, "utf-8");
      const parsed = JSON.parse(raw) as QueueState;
      this.state = {
        items: Array.isArray(parsed.items) ? parsed.items : [],
      };
    } catch {
      this.state = { items: [] };
      await this.persist();
    }
  }

  async enqueue(payload: Record<string, unknown>, idempotencyKey: string): Promise<void> {
    if (this.state.items.some((item) => item.idempotencyKey === idempotencyKey)) {
      return;
    }
    this.state.items.push({
      payload,
      idempotencyKey,
      attempts: 0,
      nextAttemptAt: Date.now(),
      lastError: null,
      createdAt: Date.now(),
    });
    await this.persist();
  }

  listDue(now: number): QueuedCapture[] {
    return this.state.items.filter((item) => item.nextAttemptAt <= now);
  }

  async markSucceeded(idempotencyKey: string): Promise<void> {
    this.state.items = this.state.items.filter((item) => item.idempotencyKey !== idempotencyKey);
    await this.persist();
  }

  async markFailed(idempotencyKey: string, error: string): Promise<void> {
    const item = this.state.items.find((entry) => entry.idempotencyKey === idempotencyKey);
    if (!item) return;
    item.attempts += 1;
    item.lastError = error.slice(0, 512);
    const backoff = Math.min(60_000, 1000 * 2 ** item.attempts);
    const jitter = Math.floor(Math.random() * 300);
    item.nextAttemptAt = Date.now() + backoff + jitter;
    await this.persist();
  }

  private async persist(): Promise<void> {
    await fs.writeFile(this.queueFile, JSON.stringify(this.state, null, 2), "utf-8");
  }
}
