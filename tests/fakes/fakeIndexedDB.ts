/*
 * IndexedDB SIMULADO y mínimo, solo para probar `IndexedDbLibraryStorage`.
 * No es una implementación completa: cubre `open` (con `upgradeneeded`,
 * `blocked` y `VersionError`), `transaction` sobre varios almacenes con
 * `put`/`delete`/`get`/`getAll`, autocommit al final de la tarea, aborto
 * atómico (nada se aplica si una operación falla), `close` y `versionchange`.
 */

type Handler = ((event: { preventDefault(): void }) => void) | null;

class FakeDomError extends Error {
  constructor(name: string) {
    super(name);
    this.name = name;
  }
}

class FakeRequest<T = unknown> {
  result: T | undefined;
  error: Error | null = null;
  onsuccess: Handler = null;
  onerror: Handler = null;
}

class FakeOpenRequest extends FakeRequest<FakeDb> {
  onupgradeneeded: Handler = null;
  onblocked: Handler = null;
}

type Op =
  | { kind: 'put'; store: string; value: Record<string, unknown>; request: FakeRequest }
  | { kind: 'delete'; store: string; key: string; request: FakeRequest }
  | { kind: 'get'; store: string; key: string; request: FakeRequest }
  | { kind: 'getAll'; store: string; request: FakeRequest };

export interface FakeIdbOptions {
  /** La clave (id) cuyo `put` falla con este error, abortando la transacción. */
  failPut?: { key: string; error: string } | null;
  /** `open` informa `blocked` (y tarda en tener éxito). */
  blocked?: boolean;
  /** La base existente es de una versión mayor. */
  existingVersion?: number;
}

export class FakeIDBFactory {
  readonly data = new Map<string, Map<string, Record<string, unknown>>>();
  readonly keyPaths = new Map<string, string>();
  version = 0;
  readonly connections: FakeDb[] = [];
  opens = 0;
  options: FakeIdbOptions;

  constructor(options: FakeIdbOptions = {}) {
    this.options = options;
    if (options.existingVersion) this.version = options.existingVersion;
  }

  open(_name: string, version: number): FakeOpenRequest {
    this.opens++;
    const request = new FakeOpenRequest();
    setTimeout(() => {
      if (version < this.version) {
        request.error = new FakeDomError('VersionError');
        request.onerror?.({ preventDefault() {} });
        return;
      }
      if (this.options.blocked) {
        request.onblocked?.({ preventDefault() {} });
        return;
      }
      const db = new FakeDb(this);
      this.connections.push(db);
      request.result = db;
      if (version > this.version) {
        this.version = version;
        request.onupgradeneeded?.({ preventDefault() {} });
      }
      request.onsuccess?.({ preventDefault() {} });
    }, 0);
    return request;
  }

  /** Simula otra pestaña que actualiza la versión. */
  fireVersionChange(): void {
    for (const db of this.connections) if (!db.closed) db.onversionchange?.();
  }

  store(name: string): Map<string, Record<string, unknown>> {
    return this.data.get(name)!;
  }
}

class FakeDb {
  closed = false;
  onversionchange: (() => void) | null = null;
  onclose: (() => void) | null = null;
  constructor(readonly factory: FakeIDBFactory) {}

  get objectStoreNames() {
    return { contains: (name: string) => this.factory.data.has(name) };
  }

  createObjectStore(name: string, { keyPath }: { keyPath: string }) {
    this.factory.data.set(name, new Map());
    this.factory.keyPaths.set(name, keyPath);
  }

  transaction(stores: string[], _mode: string) {
    if (this.closed) throw new FakeDomError('InvalidStateError');
    return new FakeTx(this.factory, stores);
  }

  close(): void {
    this.closed = true;
  }
}

class FakeTx {
  error: Error | null = null;
  oncomplete: (() => void) | null = null;
  onabort: (() => void) | null = null;
  onerror: Handler = null;
  readonly ops: Op[] = [];
  #aborted = false;

  constructor(
    readonly factory: FakeIDBFactory,
    readonly stores: string[],
  ) {
    // Autocommit cuando termina la tarea actual (como IndexedDB).
    setTimeout(() => this.#finish(), 0);
  }

  objectStore(name: string) {
    if (!this.stores.includes(name)) throw new FakeDomError('NotFoundError');
    const keyPath = this.factory.keyPaths.get(name)!;
    const push = (op: Op) => {
      this.ops.push(op);
      return op.request;
    };
    return {
      put: (value: Record<string, unknown>) => push({ kind: 'put', store: name, value, request: new FakeRequest() }),
      delete: (key: string) => push({ kind: 'delete', store: name, key, request: new FakeRequest() }),
      get: (key: string) => push({ kind: 'get', store: name, key, request: new FakeRequest() }),
      getAll: () => push({ kind: 'getAll', store: name, request: new FakeRequest() }),
      keyPath,
    };
  }

  abort(): void {
    if (this.#aborted) return;
    this.#aborted = true;
    this.error ??= new FakeDomError('AbortError');
    setTimeout(() => this.onabort?.(), 0);
  }

  #finish(): void {
    if (this.#aborted) return;
    // Copia de trabajo: solo se aplica si todas las operaciones salen bien.
    const working = new Map([...this.factory.data].map(([k, v]) => [k, new Map(v)]));
    for (const op of this.ops) {
      const store = working.get(op.store)!;
      const keyPath = this.factory.keyPaths.get(op.store)!;
      if (op.kind === 'put') {
        const key = String(op.value[keyPath]);
        const fail = this.factory.options.failPut;
        if (fail && fail.key === key) {
          op.request.error = new FakeDomError(fail.error);
          this.error = op.request.error;
          let prevented = false;
          op.request.onerror?.({ preventDefault: () => (prevented = true) });
          this.onerror?.({ preventDefault: () => (prevented = true) });
          if (!prevented) {
            this.#aborted = true;
            this.onabort?.();
            return;
          }
          continue;
        }
        store.set(key, op.value);
      } else if (op.kind === 'delete') {
        store.delete(op.key);
      } else if (op.kind === 'get') {
        op.request.result = store.get(op.key);
      } else {
        op.request.result = [...store.values()];
      }
    }
    for (const [name, map] of working) this.factory.data.set(name, map);
    this.oncomplete?.();
  }
}
