import { accessSync, constants, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

// Where canonical data lives, and the one rule about writing it.
//
// Production runs on Vercel, whose functions have a read-only filesystem. The
// canonical AIE payloads are files in the repository, and the durable
// transaction for changing them is a commit. So the store REFUSES to write
// unless three things are true: it is not running on Vercel, the operator has
// set DATAOPS_WRITE=1 in the environment they started the server from, and the
// directory is actually writable. Discovery, review, categorisation and
// validation work everywhere; ingestion works on an operator's checkout, and
// the commit that follows is what makes it real.

export interface CanonicalStore {
  readonly root: string;
  read(file: string): Promise<string | null>;
  /** Write every file or none: temps first, renames only once all temps exist. */
  write(files: Record<string, string>): Promise<void>;
  writable(): boolean;
  /** Why writes are refused, for the operator. Empty when writable. */
  reason(): string;
}

/** In-memory store for tests and for the browser-side staging round trip. */
export class MemoryStore implements CanonicalStore {
  readonly root = "memory";
  private files: Map<string, string>;
  private readonly canWrite: boolean;
  constructor(initial: Record<string, string> = {}, opts: { writable?: boolean } = {}) {
    this.files = new Map(Object.entries(initial));
    this.canWrite = opts.writable ?? true;
  }
  async read(file: string): Promise<string | null> {
    return this.files.get(file) ?? null;
  }
  async write(files: Record<string, string>): Promise<void> {
    if (!this.canWrite) throw new Error(`canonical store is read-only: ${this.reason()}`);
    for (const [f, c] of Object.entries(files)) this.files.set(f, c);
  }
  writable(): boolean {
    return this.canWrite;
  }
  reason(): string {
    return this.canWrite ? "" : "this store was opened read-only";
  }
  snapshot(): Record<string, string> {
    return Object.fromEntries(this.files);
  }
}

/** The repository's fixtures directory. */
export class FsStore implements CanonicalStore {
  readonly root: string;
  /**
   * DATAOPS_ROOT points the store at a copy of the fixtures, so a flow can be
   * rehearsed end to end on staging data before it is ever run on the real
   * files. The ingest route skips derived regeneration in that mode, because
   * the derived scripts read the real fixtures.
   */
  constructor(root: string = process.env.DATAOPS_ROOT ?? path.join(process.cwd(), "fixtures", "aie-live")) {
    this.root = root;
  }
  async read(file: string): Promise<string | null> {
    try {
      return readFileSync(path.join(this.root, file), "utf8");
    } catch {
      return null;
    }
  }
  writable(): boolean {
    return this.reason() === "";
  }
  reason(): string {
    if (process.env.VERCEL) return "production runs on Vercel, whose filesystem is read-only; ingest from an operator checkout";
    if (process.env.DATAOPS_WRITE !== "1") return "DATAOPS_WRITE=1 is not set in this server's environment";
    try {
      accessSync(this.root, constants.W_OK);
    } catch {
      return `${this.root} is not writable`;
    }
    return "";
  }
  async write(files: Record<string, string>): Promise<void> {
    if (!this.writable()) throw new Error(`canonical store is read-only: ${this.reason()}`);
    const temps: { tmp: string; final: string }[] = [];
    try {
      for (const [file, content] of Object.entries(files)) {
        const final = path.join(this.root, file);
        const tmp = `${final}.tmp-${process.pid}`;
        writeFileSync(tmp, content);
        temps.push({ tmp, final });
      }
    } catch (err) {
      for (const t of temps) rmSync(t.tmp, { force: true });
      throw err;
    }
    for (const t of temps) renameSync(t.tmp, t.final);
  }
}
