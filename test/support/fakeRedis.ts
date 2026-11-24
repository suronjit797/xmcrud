// Minimal in-memory stand-in for ioredis: get, set (EX), scan (MATCH), unlink, keyPrefix.
// keyPrefix behaves like ioredis: applied to get/set/unlink, not to SCAN's MATCH pattern.

const globToRegex = (pattern: string) =>
  new RegExp(`^${pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".")}$`);

export class FakeRedis {
  store = new Map<string, string>();
  options: { keyPrefix: string };
  commands: string[] = [];
  /** set to make every command throw (simulates redis being down) */
  failing = false;

  constructor(keyPrefix = "") {
    this.options = { keyPrefix };
  }

  private check(command: string) {
    this.commands.push(command);
    if (this.failing) throw new Error("redis down");
  }

  async get(key: string) {
    this.check("get");
    return this.store.get(this.options.keyPrefix + key) ?? null;
  }

  async set(key: string, value: string, ..._args: unknown[]) {
    this.check("set");
    this.store.set(this.options.keyPrefix + key, value);
    return "OK";
  }

  // like real SCAN, keys deleted mid-iteration must not make later keys get skipped,
  // so iterate over a snapshot taken when the scan starts (cursor "0")
  private scanSnapshot: string[] = [];

  async scan(cursor: string, _match: string, pattern: string, _count: string, count: number): Promise<[string, string[]]> {
    this.check("scan");
    if (cursor === "0") {
      const regex = globToRegex(pattern);
      this.scanSnapshot = [...this.store.keys()].filter((k) => regex.test(k));
    }
    const all = this.scanSnapshot;
    const start = Number(cursor);
    const page = all.slice(start, start + count);
    const next = start + count >= all.length ? "0" : String(start + count);
    return [next, page];
  }

  async unlink(...keys: string[]) {
    this.check("unlink");
    let removed = 0;
    for (const key of keys) if (this.store.delete(this.options.keyPrefix + key)) removed++;
    return removed;
  }

  async keys(): Promise<string[]> {
    throw new Error("KEYS must not be used");
  }
}

export const createFakeRedis = (keyPrefix = "") => new FakeRedis(keyPrefix) as any;
