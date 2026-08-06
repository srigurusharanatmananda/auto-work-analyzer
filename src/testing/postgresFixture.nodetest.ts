/**
 * The fixture other database suites are about to depend on.
 *
 * Worth its own tests because its failure mode is silent: a fixture that hands
 * back an empty schema, or one that quietly resolves to `public`, would let
 * every downstream suite pass or fail for reasons that have nothing to do with
 * the code under test.
 */
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDatabase, type TestDatabase } from './postgresFixture.js';
import { openPostgres } from '../db/client.js';

let db: TestDatabase;

before(async () => {
  db = await createTestDatabase();
});

after(async () => {
  await db?.drop();
});

describe('postgres test fixture', () => {
  test('the schema has the full table set, not an empty database', async () => {
    const rows = await db.sql<Array<{ table_name: string }>>`
      SELECT table_name FROM information_schema.tables
       WHERE table_schema = ${db.schemaName}
    `;
    const tables = rows.map((r) => r.table_name).sort();

    // The count is asserted so that a migration file silently failing to apply
    // shows up here rather than as a confusing "relation does not exist" in
    // some unrelated suite. Bump it deliberately when a migration adds a table —
    // that is the guard working, not noise.
    assert.equal(tables.length, 15, `expected 15 tables, got: ${tables.join(', ')}`);
    assert.ok(tables.includes('users'));
    assert.ok(tables.includes('task_templates'));
    assert.ok(tables.includes('analysis_history'));
    // From migration 0001 — proves later migrations apply, not just the first.
    assert.ok(tables.includes('transcription_jobs'));
  });

  test('unqualified writes land in the test schema, never in public', async () => {
    await db.sql`
      INSERT INTO users (id, email, password_hash, full_name, role, created_at, updated_at)
      VALUES ('fixture-user', 'fixture@example.com', 'x', 'Fixture', 'user', 'now', 'now')
    `;

    const [mine] = await db.sql`SELECT COUNT(*)::int AS count FROM users`;
    assert.equal(mine!.count, 1);

    // And the same query through a connection with the default search_path must
    // not see it. If `public.users` does not exist at all, that is also a pass:
    // the row certainly did not go there.
    const plain = openPostgres(process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL!, {
      max: 1,
    });
    try {
      const [exists] = await plain.sql<Array<{ oid: string | null }>>`
        SELECT to_regclass('public.users')::text AS oid
      `;

      if (exists!.oid !== null) {
        const [leaked] = await plain.sql<Array<{ count: number }>>`
          SELECT COUNT(*)::int AS count FROM public.users WHERE id = 'fixture-user'
        `;
        assert.equal(leaked!.count, 0, 'the fixture wrote into the real public schema');
      }
    } finally {
      await plain.close();
    }
  });

  test('two fixtures do not see each other', async () => {
    const other = await createTestDatabase();
    try {
      assert.notEqual(other.schemaName, db.schemaName);

      const [count] = await other.sql`SELECT COUNT(*)::int AS count FROM users`;
      assert.equal(count!.count, 0, 'a fresh fixture must not see the other suite rows');
    } finally {
      await other.drop();
    }
  });

  test('drop removes the schema, and is safe to call twice', async () => {
    const temp = await createTestDatabase();
    const { schemaName } = temp;

    await temp.drop();
    await temp.drop(); // must not throw

    const probe = openPostgres(process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL!, {
      max: 1,
    });
    try {
      const [row] = await probe.sql<Array<{ count: number }>>`
        SELECT COUNT(*)::int AS count FROM pg_namespace WHERE nspname = ${schemaName}
      `;
      assert.equal(row!.count, 0, 'the schema outlived drop()');
    } finally {
      await probe.close();
    }
  });
});
