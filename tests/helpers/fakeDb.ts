// In-memory fake of the Supabase client surface used by server actions. Extend as later tasks need.
type Row = Record<string, unknown>;
export const USER_ID = 'user-1';

const state = {
  tables: {} as Record<string, Row[]>,
  log: [] as { op: 'insert' | 'update' | 'upsert' | 'delete'; table: string; values: Row }[],
  files: [] as { bucket: string; path: string; size: number }[],
  signedIn: true,
  rpcResult: true as unknown,
  nextId: 0,
  hidden: new Set<string>(),
  failures: [] as { table: string; error: { code?: string; message: string }; onFail?: () => void }[],
};

const rows = (t: string) => (state.tables[t] ??= []);
const logged = (op: string, t: string) => state.log.filter((l) => l.op === op && l.table === t).map((l) => l.values);

const out = (r: Row[] | { error: unknown }, pick: (d: Row[]) => unknown) =>
  Array.isArray(r) ? { data: pick(r), error: null } : { data: null, error: r.error };

function builder(table: string) {
  let op: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select';
  let values: Row = {};
  const filters: ((r: Row) => boolean)[] = [];
  const match = () => rows(table).filter((r) => filters.every((f) => f(r)) && !(table === 'jobs' && state.hidden.has(r.id as string)));
  const run = (): Row[] | { error: { code?: string; message: string } } => {
    if (op !== 'select') {
      const i = state.failures.findIndex((f) => f.table === table);
      if (i >= 0) { const [f] = state.failures.splice(i, 1); f.onFail?.(); return { error: f.error }; }
    }
    if (op === 'insert' || op === 'upsert') {
      state.log.push({ op, table, values });
      const row = { id: `id-${++state.nextId}`, ...values }; // the database assigns ids
      rows(table).push(row);
      return [row];
    }
    if (op === 'update') { state.log.push({ op, table, values }); match().forEach((r) => Object.assign(r, values)); return []; }
    if (op === 'delete') { state.log.push({ op, table, values: {} }); state.tables[table] = rows(table).filter((r) => !match().includes(r)); return []; }
    return match();
  };
  const b = {
    select: () => b,
    insert: (v: Row) => { op = 'insert'; values = v; return b; },
    update: (v: Row) => { op = 'update'; values = v; return b; },
    upsert: (v: Row) => { op = 'upsert'; values = v; return b; },
    delete: () => { op = 'delete'; return b; },
    eq: (k: string, v: unknown) => { filters.push((r) => r[k] === v); return b; },
    in: (k: string, vs: unknown[]) => { filters.push((r) => vs.includes(r[k])); return b; },
    is: (k: string, v: unknown) => { filters.push((r) => (r[k] ?? null) === v); return b; },
    single: async () => out(run(), (d) => d[0] ?? null),
    maybeSingle: async () => out(run(), (d) => d[0] ?? null),
    then: (res: (v: unknown) => unknown) => Promise.resolve(out(run(), (d) => d)).then(res),
  };
  return b;
}

export const db = {
  client: {
    auth: { getUser: async () => ({ data: { user: state.signedIn ? { id: USER_ID } : null }, error: null }) },
    from: builder,
    rpc: async () => ({ data: state.rpcResult, error: null }),
    storage: { from: (bucket: string) => ({ upload: async (path: string, body: { size?: number; byteLength?: number }) => {
      state.files.push({ bucket, path, size: body.size ?? body.byteLength ?? 0 });
      return { data: { path }, error: null };
    } }) },
  },
  /** The next write (insert/update/upsert/delete) on `table` fails with `error`; `onFail` simulates a concurrent writer. */
  failNext: (table: string, error: { code?: string; message: string }, onFail?: () => void) => { state.failures.push({ table, error, onFail }); },
  seedJob: (row: Row) => { rows('jobs').push({ owner_id: null, title: 'Job', company_name: 'Co', ...row }); },
  /** Simulates RLS hiding a job from the signed-in user. */
  hideJob: (id: string) => { state.hidden.add(id); },
  seed: (table: string, r: Row[]) => { state.tables[table] = r.map((x) => ({ ...x })); },
  signOut: () => { state.signedIn = false; },
  inserts: (t: string) => logged('insert', t),
  updates: (t: string) => logged('update', t),
  upserts: (t: string) => logged('upsert', t),
  deletes: (t: string) => logged('delete', t),
  uploads: () => state.files,
  count: (t: string) => rows(t).length,
  reset: () => { state.tables = {}; state.log = []; state.files = []; state.signedIn = true; state.rpcResult = true; state.nextId = 0; state.failures = []; state.hidden = new Set(); },
};
