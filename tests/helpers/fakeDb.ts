// In-memory fake of the Supabase client surface used by server actions. Extend as later tasks need.
type Row = Record<string, unknown>;
export const USER_ID = 'user-1';

const state = {
  tables: {} as Record<string, Row[]>,
  log: [] as { op: 'insert' | 'update' | 'upsert' | 'delete'; table: string; values: Row }[],
  files: [] as { bucket: string; path: string; size: number }[],
  signedIn: true,
  rpcResult: true as unknown,
};

const rows = (t: string) => (state.tables[t] ??= []);
const logged = (op: string, t: string) => state.log.filter((l) => l.op === op && l.table === t).map((l) => l.values);

function builder(table: string) {
  let op: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select';
  let values: Row = {};
  const filters: [string, unknown][] = [];
  const match = () => rows(table).filter((r) => filters.every(([k, v]) => r[k] === v));
  const run = () => {
    if (op === 'insert' || op === 'upsert') { state.log.push({ op, table, values }); rows(table).push({ ...values }); return []; }
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
    eq: (k: string, v: unknown) => { filters.push([k, v]); return b; },
    single: async () => ({ data: run()[0] ?? null, error: null }),
    maybeSingle: async () => ({ data: run()[0] ?? null, error: null }),
    then: (res: (v: unknown) => unknown) => Promise.resolve({ data: run(), error: null }).then(res),
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
  seed: (table: string, r: Row[]) => { state.tables[table] = r.map((x) => ({ ...x })); },
  signOut: () => { state.signedIn = false; },
  inserts: (t: string) => logged('insert', t),
  updates: (t: string) => logged('update', t),
  upserts: (t: string) => logged('upsert', t),
  deletes: (t: string) => logged('delete', t),
  uploads: () => state.files,
  count: (t: string) => rows(t).length,
  reset: () => { state.tables = {}; state.log = []; state.files = []; state.signedIn = true; state.rpcResult = true; },
};
