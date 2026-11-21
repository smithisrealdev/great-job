// @vitest-environment node
import { beforeAll, expect, test } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

const sql = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');
let db: PGlite;
let A: string, B: string, privateJobOfA: string, sharedJob: string;

// Run fn inside a transaction as the given user (null = service role / superuser).
async function as<T>(uid: string, fn: (tx: PGlite) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.query('set local role authenticated');
    await tx.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: uid })]);
    return fn(tx as unknown as PGlite);
  });
}
const rows = async (tx: PGlite, q: string, p: unknown[] = []) => (await tx.query<Record<string, unknown>>(q, p)).rows;

// A failed statement aborts the transaction, so isolate it in a savepoint.
async function fails(tx: PGlite, q: string, p: unknown[] = []) {
  await tx.query('savepoint s');
  try { await tx.query(q, p); return false; } catch { return true; } finally { await tx.query('rollback to savepoint s'); }
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(sql('./supabaseShim.sql'));
  await db.exec(sql('../../supabase/migrations/0001_init.sql'));
  await db.exec(sql('../../supabase/migrations/0002_user_job_sources.sql'));
  await db.exec(sql('../../supabase/migrations/0003_companies_admin_insert.sql'));
  A = (await db.query<{ id: string }>(`insert into auth.users (email) values ('a@x.test') returning id`)).rows[0].id;
  B = (await db.query<{ id: string }>(`insert into auth.users (email) values ('b@x.test') returning id`)).rows[0].id;
  privateJobOfA = (await db.query<{ id: string }>(
    `insert into jobs (owner_id, source, external_id, title) values ($1, 'manual', 'p1', 'Private') returning id`, [A])).rows[0].id;
  sharedJob = (await db.query<{ id: string }>(
    `insert into jobs (source, external_id, title) values ('greenhouse', 's1', 'Shared') returning id`)).rows[0].id;
  await db.query(`insert into evaluations (user_id, job_id) values ($1, $2)`, [A, sharedJob]);
  await db.query(`insert into applications (user_id, job_id) values ($1, $2)`, [A, sharedJob]);
});

test('signup trigger creates a profile row', async () => {
  expect(await as(A, (tx) => rows(tx, 'select user_id from profiles'))).toEqual([{ user_id: A }]);
});

test('B cannot read A profile, evaluations, applications or private jobs', async () => {
  await as(B, async (tx) => {
    for (const t of ['profiles', 'evaluations', 'applications']) {
      expect(await rows(tx, `select * from ${t} where user_id = $1`, [A])).toEqual([]);
    }
    expect(await rows(tx, 'select * from jobs where id = $1', [privateJobOfA])).toEqual([]);
  });
});

test('both users can read shared jobs, neither can modify them', async () => {
  for (const u of [A, B]) {
    await as(u, async (tx) => {
      expect(await rows(tx, 'select id from jobs where id = $1', [sharedJob])).toHaveLength(1);
      expect(await rows(tx, `update jobs set title = 'x' where id = $1 returning id`, [sharedJob])).toEqual([]);
    });
  }
});

test('users can only insert jobs they own', async () => {
  await as(A, async (tx) => {
    expect(await fails(tx, `insert into jobs (source, external_id, title) values ('m', 'n1', 't')`)).toBe(true);
  });
});

test('users can only write paste or extension jobs, never shared sources', async () => {
  await as(A, async (tx) => {
    const ins = (src: string, owner: string | null) =>
      fails(tx, `insert into jobs (owner_id, source, external_id, title) values ($1, $2, 'x-' || $2, 't')`, [owner, src]);
    expect(await ins('greenhouse', A)).toBe(true);
    expect(await ins('greenhouse', null)).toBe(true);
    expect(await ins('paste', A)).toBe(false);
    expect(await ins('extension', A)).toBe(false);
    // cannot rewrite an own row into a shared source
    const [own] = await rows(tx, `insert into jobs (owner_id, source, external_id, title) values ($1, 'paste', 'own', 't') returning id`, [A]);
    expect(await fails(tx, `update jobs set source = 'lever' where id = $1`, [own.id])).toBe(true);
    expect(await rows(tx, `update jobs set title = 'x' where id = $1 returning id`, [privateJobOfA])).toEqual([]); // legacy source rows are read-only
  });
});

test('companies are readable but users cannot insert, edit or delete them', async () => {
  await db.query(`insert into companies (name, ats, board_token) values ('Acme', 'lever', 'acme')`);
  await as(A, async (tx) => {
    expect(await fails(tx, `insert into companies (name, ats, board_token) values ('Evil', 'lever', 'evil')`)).toBe(true);
    expect(await rows(tx, 'select id from companies')).toHaveLength(1);
    expect(await rows(tx, `update companies set name = 'x' returning id`)).toEqual([]);
    expect(await rows(tx, 'delete from companies returning id')).toEqual([]);
  });
});

test('job_sightings is closed to users', async () => {
  await db.query(`insert into job_sightings values ('f', 'd.com', current_date)`);
  await as(A, async (tx) => {
    expect(await rows(tx, 'select * from job_sightings')).toEqual([]);
  });
});

test('consume_quota allows up to the limit then refuses; users cannot write ai_usage directly', async () => {
  await as(A, async (tx) => {
    const q = async () => (await rows(tx, `select consume_quota('t', 2) as ok`))[0].ok;
    expect(await q()).toBe(true);
    expect(await q()).toBe(true);
    expect(await q()).toBe(false);
    expect(await rows(tx, 'select count from ai_usage')).toEqual([{ count: 3 }]);
  });
  await as(B, async (tx) => {
    expect(await rows(tx, 'select * from ai_usage')).toEqual([]);
    expect(await fails(tx, `insert into ai_usage values ($1, current_date, 'x', 0)`, [B])).toBe(true);
  });
});

test('A cannot write a resume file into B folder', async () => {
  await as(A, async (tx) => {
    expect(await fails(tx, `insert into storage.objects (bucket_id, name) values ('resumes', $1)`, [`${B}/x.pdf`])).toBe(true);
    await tx.query(`insert into storage.objects (bucket_id, name) values ('resumes', $1)`, [`${A}/x.pdf`]);
  });
});
