/* A D1 that is an in-memory SQLite, for dev.mjs and the tests.

   D1 is SQLite, so this is the real query engine rather than an imitation of
   one — a GROUP BY that is wrong here is wrong in production. Only the calling
   surface is reproduced: prepare → bind → all / first / run, and batch, which
   D1 runs as one transaction. */

/* node:sqlite is Node 22.13+. On anything older this returns undefined, which
   the Worker reads as "no database bound" — dev.mjs still serves, the tests
   say SKIPPED. */
const { DatabaseSync } = await import('node:sqlite').catch(() => ({}));
export const haveSqlite = !!DatabaseSync;

export function memoryD1() {
  if (!DatabaseSync) return undefined;
  const db = new DatabaseSync(':memory:');
  const stmt = (sql, args = []) => ({
    sql, args,
    bind: (...a) => stmt(sql, a),
    all: async () => ({ success: true, results: db.prepare(sql).all(...args) }),
    first: async col => {
      const row = db.prepare(sql).get(...args);
      return row ? (col ? row[col] : row) : null;
    },
    run: async () => {
      const r = db.prepare(sql).run(...args);
      return { success: true, meta: { changes: Number(r.changes) } };
    }
  });
  return {
    prepare: sql => stmt(sql),
    async batch(list) {
      db.exec('BEGIN');
      try {
        const out = list.map(s => ({ success: true, results: db.prepare(s.sql).all(...s.args) }));
        db.exec('COMMIT');
        return out;
      } catch (e) { db.exec('ROLLBACK'); throw e; }
    },
    /* Not D1 — a test seam for moving the clock on stored rows. */
    raw: db
  };
}
