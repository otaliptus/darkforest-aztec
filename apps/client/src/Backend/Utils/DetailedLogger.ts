import { EventEmitter } from 'events';
import { VERBOSE_LOGGING } from '../Aztec/config';

const env = process.env;

const getEnv = (primary: string, fallback?: string) => {
  const direct = env[primary];
  if (direct !== undefined && direct !== '') return direct;
  const legacy = env[`VITE_${primary}`];
  if (legacy !== undefined && legacy !== '') return legacy;
  return fallback;
};

const toBool = (value: string | undefined, fallback: boolean) => {
  if (value === undefined) return fallback;
  return value === 'true' || value === '1';
};

type FileSystemWritable = {
  write: (data: unknown) => Promise<void>;
  close: () => Promise<void>;
  seek: (position: number) => Promise<void>;
};

type FileSystemFileHandle = {
  name?: string;
  getFile: () => Promise<File>;
  createWritable: (options?: { keepExistingData?: boolean }) => Promise<FileSystemWritable>;
};

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogEntry = {
  ts: number;
  iso: string;
  level: LogLevel;
  scope: string;
  action: string;
  sessionId: string;
  correlationId?: string;
  payload?: Record<string, unknown>;
};

export type LogStatus = {
  enabled: boolean;
  fileReady: boolean;
  fileName?: string;
  buffered: number;
  recentCount: number;
  lastError?: string;
  sessionId: string;
};

const MAX_DEPTH = 4;
const MAX_ARRAY = 50;
const MAX_STRING = 1000;
const DEFAULT_FLUSH_MS = 750;
const DEFAULT_BUFFER_LIMIT = 400;
const DEFAULT_RECENT_LIMIT = 2000;

const sanitizeValue = (value: unknown, depth = 0): unknown => {
  if (depth > MAX_DEPTH) return '[MaxDepth]';
  if (value === null || value === undefined) return value;
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'string') {
    if (value.length > MAX_STRING) return `${value.slice(0, MAX_STRING)}...`;
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }
  if (Array.isArray(value)) {
    if (value.length > MAX_ARRAY) {
      return value.slice(0, MAX_ARRAY).map((entry) => sanitizeValue(entry, depth + 1));
    }
    return value.map((entry) => sanitizeValue(entry, depth + 1));
  }
  if (value instanceof Map) {
    const entries = Array.from(value.entries()).slice(0, MAX_ARRAY);
    return entries.map(([key, val]) => [sanitizeValue(key, depth + 1), sanitizeValue(val, depth + 1)]);
  }
  if (value instanceof Set) {
    const entries = Array.from(value.values()).slice(0, MAX_ARRAY);
    return entries.map((entry) => sanitizeValue(entry, depth + 1));
  }
  if (typeof value === 'object') {
    const output: Record<string, unknown> = {};
    const entries = Object.entries(value as Record<string, unknown>);
    for (const [key, val] of entries) {
      output[key] = sanitizeValue(val, depth + 1);
    }
    return output;
  }
  return String(value);
};

const sanitizePayload = (payload?: Record<string, unknown>) => {
  if (!payload) return undefined;
  return sanitizeValue(payload) as Record<string, unknown>;
};

const safeStringify = (entry: LogEntry) => {
  return `${JSON.stringify(entry)}\n`;
};

const newSessionId = () => {
  return `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
};

const newCorrelationId = () => {
  return `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
};

const normalizeError = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return JSON.stringify(sanitizeValue(error));
};

class DetailedLogger {
  private enabled = toBool(getEnv('DF_DETAILED_LOGS'), false);
  private logToConsole = toBool(getEnv('DF_LOG_TO_CONSOLE'), VERBOSE_LOGGING);
  private fileHandle?: FileSystemFileHandle;
  private fileName?: string;
  private lastError?: string;
  private flushMs = DEFAULT_FLUSH_MS;
  private bufferLimit = DEFAULT_BUFFER_LIMIT;
  private recentLimit = DEFAULT_RECENT_LIMIT;
  private pending: string[] = [];
  private recent: string[] = [];
  private flushTimer?: number;
  private flushing = false;
  private emitter = new EventEmitter();
  private sessionId = newSessionId();

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    this.emitStatus();
  }

  isEnabled() {
    return this.enabled;
  }

  setLogToConsole(enabled: boolean) {
    this.logToConsole = enabled;
    this.emitStatus();
  }

  getStatus(): LogStatus {
    return {
      enabled: this.enabled,
      fileReady: Boolean(this.fileHandle),
      fileName: this.fileName,
      buffered: this.pending.length,
      recentCount: this.recent.length,
      lastError: this.lastError,
      sessionId: this.sessionId,
    };
  }

  onStatus(handler: (status: LogStatus) => void) {
    this.emitter.on('status', handler);
    return () => this.emitter.off('status', handler);
  }

  private emitStatus() {
    this.emitter.emit('status', this.getStatus());
  }

  private supportsFilePicker() {
    return typeof window !== 'undefined' && typeof (window as any).showSaveFilePicker === 'function';
  }

  async pickLogFile(): Promise<boolean> {
    if (!this.supportsFilePicker()) {
      this.lastError = 'File logging not supported in this browser.';
      this.emitStatus();
      return false;
    }

    try {
      const suggestedName = `darkforest-actions-${new Date().toISOString().slice(0, 19).replace(/[:]/g, '-')}.ndjson`;
      const handle = (await (window as any).showSaveFilePicker({
        suggestedName,
        types: [
          {
            description: 'NDJSON logs',
            accept: { 'application/x-ndjson': ['.ndjson', '.log'] },
          },
        ],
      })) as FileSystemFileHandle;
      await this.setFileHandle(handle);
      this.enabled = true;
      this.emitStatus();
      return true;
    } catch (error) {
      const message = normalizeError(error);
      if (!message.includes('AbortError')) {
        this.lastError = message;
      }
      this.emitStatus();
      return false;
    }
  }

  async setFileHandle(handle: FileSystemFileHandle) {
    this.fileHandle = handle;
    this.fileName = handle.name;
    this.lastError = undefined;
    this.emitStatus();
    await this.flush();
  }

  async flush(): Promise<void> {
    if (!this.fileHandle || this.flushing || this.pending.length === 0) return;
    this.flushing = true;
    const batch = this.pending.splice(0, this.pending.length).join('');
    try {
      const file = await this.fileHandle.getFile();
      const writer = await this.fileHandle.createWritable({ keepExistingData: true });
      await writer.seek(file.size);
      await writer.write(batch);
      await writer.close();
      this.emitStatus();
    } catch (error) {
      this.lastError = normalizeError(error);
      this.emitStatus();
    } finally {
      this.flushing = false;
    }
  }

  downloadRecentLogs(filename?: string) {
    if (typeof window === 'undefined' || this.recent.length === 0) return;
    const name =
      filename ||
      `darkforest-actions-${new Date().toISOString().slice(0, 19).replace(/[:]/g, '-')}.ndjson`;
    const blob = new Blob([this.recent.join('')], { type: 'application/x-ndjson' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  log(scope: string, action: string, payload?: Record<string, unknown>, level: LogLevel = 'info', correlationId?: string) {
    if (!this.enabled) return;
    const entry: LogEntry = {
      ts: Date.now(),
      iso: new Date().toISOString(),
      level,
      scope,
      action,
      sessionId: this.sessionId,
      correlationId,
      payload: sanitizePayload(payload),
    };

    if (this.logToConsole || VERBOSE_LOGGING) {
      const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.info;
      fn('[DF log]', entry);
    }

    const line = safeStringify(entry);
    this.pending.push(line);
    this.recent.push(line);
    if (this.pending.length > this.bufferLimit) {
      this.pending.splice(0, this.pending.length - this.bufferLimit);
      this.lastError = 'Log buffer overflow: dropped oldest entries.';
    }
    if (this.recent.length > this.recentLimit) {
      this.recent.splice(0, this.recent.length - this.recentLimit);
    }
    if (!this.flushTimer) {
      const schedule = typeof window !== 'undefined' ? window.setTimeout : setTimeout;
      this.flushTimer = schedule(() => {
        this.flushTimer = undefined;
        void this.flush();
      }, this.flushMs) as unknown as number;
    }
    this.emitStatus();
  }

  start(scope: string, action: string, payload?: Record<string, unknown>): string {
    const correlationId = newCorrelationId();
    this.log(scope, `${action}.start`, payload, 'info', correlationId);
    return correlationId;
  }

  end(scope: string, action: string, correlationId: string, payload?: Record<string, unknown>) {
    this.log(scope, `${action}.end`, payload, 'info', correlationId);
  }

  error(scope: string, action: string, correlationId: string, payload?: Record<string, unknown>) {
    this.log(scope, `${action}.error`, payload, 'error', correlationId);
  }

  getAztecLogFn(): ((message: string, data?: Record<string, unknown>) => void) | undefined {
    if (!this.enabled) return undefined;
    return (message: string, data?: Record<string, unknown>) => {
      this.log('aztec', 'client', { message, ...(data ?? {}) });
    };
  }
}

export const detailedLogger = new DetailedLogger();
