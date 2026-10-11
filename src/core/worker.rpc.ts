import { logger } from './logger.js';

declare const self: Worker;
declare const postMessage: (message: any) => void;

export interface RpcRequestMessage<TMethod extends string = string> {
  type: 'request';
  id: number;
  method: TMethod;
  params?: unknown;
}

export interface RpcResponseMessage {
  type: 'response';
  id: number;
  ok: boolean;
  result?: unknown;
  error?: string;
}

export interface RpcReadyMessage {
  type: 'ready';
}

export type RpcWorkerMessage = RpcResponseMessage | RpcReadyMessage | RpcRequestMessage;

export type RpcHandler = (params: any) => Promise<any> | any;

interface RpcPendingRequest {
  resolve: (value: any) => void;
  reject: (reason: Error) => void;
}

const WORKER_READY_TIMEOUT_MS = 60_000;
const MAX_RESTART_ATTEMPTS = 3;
const RESTART_DELAY_MS = 2000;

/**
 * Worker-side counterpart of WorkerRpcClient: answers requests coming from
 * the main thread and can also call back into the main thread.
 */
export class WorkerRpcHostClient {
  private pending: Map<number, RpcPendingRequest> = new Map();
  private handlers: Map<string, RpcHandler> = new Map();
  private nextId = 1;

  constructor() {
    self.onmessage = (event: MessageEvent) => this.handleMessage(event.data);
  }

  public registerHandler(method: string, handler: RpcHandler): void {
    this.handlers.set(method, handler);
  }

  public async call<T>(method: string, params?: unknown): Promise<T> {
    const id = this.nextId++;
    const request: RpcRequestMessage = { type: 'request', id, method, params };

    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      try {
        postMessage(request);
      } catch (error) {
        this.pending.delete(id);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  private handleMessage(message: any): void {
    if (!message || typeof message !== 'object') return;

    if (message.type === 'response') {
      const pending = this.pending.get(message.id);
      if (!pending) return;

      this.pending.delete(message.id);

      if (message.ok) {
        pending.resolve(message.result);
      } else {
        pending.reject(new Error(message.error || 'Host request failed'));
      }
      return;
    }

    if (message.type === 'request') {
      void this.dispatch(message as RpcRequestMessage);
    }
  }

  private async dispatch(request: RpcRequestMessage): Promise<void> {
    const handler = this.handlers.get(request.method);
    if (!handler) {
      this.respond({ type: 'response', id: request.id, ok: false, error: `Unknown method: ${String(request.method)}` });
      return;
    }

    try {
      this.respond({ type: 'response', id: request.id, ok: true, result: await handler(request.params) });
    } catch (error) {
      this.respond({
        type: 'response',
        id: request.id,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private respond(response: RpcResponseMessage): void {
    postMessage(response);
  }
}

/**
 * Base class for main-thread proxies that talk to a Bun worker
 * over a request/response protocol with a ready handshake.
 */
export abstract class WorkerRpcClient<TMethod extends string> {
  private worker: Worker | null = null;
  private pending: Map<number, RpcPendingRequest> = new Map();
  private hostHandlers: Map<string, RpcHandler> = new Map();
  private nextId = 1;
  private readyPromise: Promise<void> | null = null;
  private readyResolve: (() => void) | null = null;
  private readyReject: ((reason: Error) => void) | null = null;
  private restartAttempts = 0;
  private restartTimer: ReturnType<typeof setTimeout> | null = null;

  protected autoRestart = false;

  protected constructor(private readonly workerPath: string) {}

  public get isWorkerAlive(): boolean {
    return this.worker !== null;
  }

  protected ensureWorker(): Worker {
    if (this.worker) return this.worker;

    this.readyPromise = new Promise<void>((resolve, reject) => {
      this.readyResolve = resolve;
      this.readyReject = reject;
    });

    const worker = new Worker(this.workerPath);
    worker.onmessage = (event: MessageEvent) => this.handleMessage(event.data as RpcWorkerMessage);
    worker.onerror = (event: ErrorEvent) =>
      this.handleWorkerError(new Error(event.message || 'Worker crashed'));

    this.worker = worker;
    logger.info({ path: this.workerPath }, 'Worker spawned');
    return worker;
  }

  protected registerHostHandler(method: string, handler: RpcHandler): void {
    this.hostHandlers.set(method, handler);
  }

  private handleMessage(message: RpcWorkerMessage | undefined): void {
    if (!message || typeof message !== 'object') return;

    if (message.type === 'ready') {
      logger.info('Worker is ready');
      this.restartAttempts = 0;
      this.readyResolve?.();
      this.readyResolve = null;
      this.readyReject = null;
      return;
    }

    if (message.type === 'request') {
      void this.dispatchHostRequest(message);
      return;
    }

    const pending = this.pending.get(message.id);
    if (!pending) return;

    this.pending.delete(message.id);

    if (message.ok) {
      pending.resolve(message.result);
    } else {
      pending.reject(new Error(message.error || 'Worker request failed'));
    }
  }

  private async dispatchHostRequest(request: RpcRequestMessage): Promise<void> {
    const handler = this.hostHandlers.get(request.method);
    if (!handler) {
      this.postToWorker({ type: 'response', id: request.id, ok: false, error: `Unknown method: ${String(request.method)}` });
      return;
    }

    try {
      this.postToWorker({ type: 'response', id: request.id, ok: true, result: await handler(request.params) });
    } catch (error) {
      this.postToWorker({
        type: 'response',
        id: request.id,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private postToWorker(message: RpcResponseMessage): void {
    if (!this.worker) {
      logger.warn('Worker is gone, dropping response');
      return;
    }
    this.worker.postMessage(message);
  }

  private handleWorkerError(error: Error): void {
    logger.error({ err: error }, 'Worker error');

    this.readyReject?.(error);
    this.readyResolve = null;
    this.readyReject = null;
    this.worker = null;

    for (const [, pending] of this.pending) {
      pending.reject(error);
    }
    this.pending.clear();

    this.scheduleRestart();
  }

  private scheduleRestart(): void {
    if (!this.autoRestart || this.restartTimer) return;

    if (this.restartAttempts >= MAX_RESTART_ATTEMPTS) {
      logger.error('Worker restart limit reached, giving up');
      return;
    }

    this.restartAttempts++;
    const delay = RESTART_DELAY_MS * this.restartAttempts;

    this.restartTimer = setTimeout(() => {
      this.restartTimer = null;

      try {
        this.ensureWorker();
        void this.onWorkerRestarted();
      } catch (error) {
        logger.error({ err: error }, 'Worker restart failed');
        this.scheduleRestart();
      }
    }, delay);
  }

  protected async onWorkerRestarted(): Promise<void> { }

  private async waitForWorker(worker: Worker): Promise<void> {
    if (!this.readyPromise) return;

    const expired = Symbol('ready-timeout');
    const timeout = new Promise<typeof expired>((resolve) =>
      setTimeout(() => resolve(expired), WORKER_READY_TIMEOUT_MS)
    );

    const outcome = await Promise.race([this.readyPromise.then(() => undefined), timeout]);
    if (outcome === expired) {
      worker.terminate();
      this.worker = null;
      throw new Error(`Worker did not become ready within ${WORKER_READY_TIMEOUT_MS}ms`);
    }
  }

  protected async call<T>(method: TMethod, params?: unknown): Promise<T> {
    const worker = this.ensureWorker();
    await this.waitForWorker(worker);

    const id = this.nextId++;
    const request: RpcRequestMessage<TMethod> = { type: 'request', id, method, params };

    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      try {
        worker.postMessage(request);
      } catch (error) {
        this.pending.delete(id);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  public terminate(): void {
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    this.restartAttempts = 0;

    this.worker?.terminate();
    this.worker = null;
    this.readyPromise = null;
    this.readyResolve = null;
    this.readyReject = null;

    for (const [, pending] of this.pending) {
      pending.reject(new Error('Worker terminated'));
    }
    this.pending.clear();
  }
}
