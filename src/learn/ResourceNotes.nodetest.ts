/**
 * `learn_resource_notes`: a learner's own notes on a reading resource.
 *
 * Runs against a real Postgres schema of its own, under `tsx --test` — the
 * same fixture `Progress.nodetest.ts` uses.
 */
import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { ResourceNotesStore } from './ResourceNotes.js';
import { createTestDatabase, type TestDatabase } from '../testing/postgresFixture.js';

const ALICE = 'user-alice';
const BOB = 'user-bob';

let db: TestDatabase;
let notes: ResourceNotesStore;

before(async () => {
  db = await createTestDatabase();
});

after(async () => {
  await db?.drop();
});

beforeEach(async () => {
  await db.sql`TRUNCATE learn_resource_notes`;
  notes = new ResourceNotesStore(db);
});

describe('create / list', () => {
  test('a created note shows up in list for that user and resource', async () => {
    await notes.create(ALICE, 'skt-primer-perry', 'Started lesson I today.');

    const rows = await notes.list(ALICE, 'skt-primer-perry');
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.note, 'Started lesson I today.');
  });

  test('list for a user/resource with no rows returns an empty array', async () => {
    const rows = await notes.list(ALICE, 'skt-primer-perry');
    assert.deepEqual(rows, []);
  });

  test('a user can leave more than one note on the same resource', async () => {
    await notes.create(ALICE, 'skt-primer-perry', 'First note.');
    await notes.create(ALICE, 'skt-primer-perry', 'Second note.');

    const rows = await notes.list(ALICE, 'skt-primer-perry');
    assert.equal(rows.length, 2, 'each create() call is an independent row, not an upsert');
  });

  test('notes are scoped by resource, not just by user', async () => {
    await notes.create(ALICE, 'skt-primer-perry', 'About the primer.');
    await notes.create(ALICE, 'tam-abc-of-tamil', 'About the Tamil primer.');

    const perryNotes = await notes.list(ALICE, 'skt-primer-perry');
    const tamilNotes = await notes.list(ALICE, 'tam-abc-of-tamil');

    assert.equal(perryNotes.length, 1);
    assert.equal(tamilNotes.length, 1);
  });

  test('notes are scoped by user — one user cannot see another user’s notes on the same resource', async () => {
    await notes.create(ALICE, 'skt-primer-perry', "Alice's note.");
    await notes.create(BOB, 'skt-primer-perry', "Bob's note.");

    const aliceNotes = await notes.list(ALICE, 'skt-primer-perry');
    assert.equal(aliceNotes.length, 1);
    assert.equal(aliceNotes[0]!.note, "Alice's note.");
  });

  test('newest note comes first', async () => {
    const first = await notes.create(ALICE, 'skt-primer-perry', 'First.');
    const second = await notes.create(ALICE, 'skt-primer-perry', 'Second.');

    const rows = await notes.list(ALICE, 'skt-primer-perry');
    assert.equal(rows[0]!.id, second.id);
    assert.equal(rows[1]!.id, first.id);
  });
});

describe('remove', () => {
  test('removes the caller’s own note', async () => {
    const created = await notes.create(ALICE, 'skt-primer-perry', 'To be deleted.');

    await notes.remove(ALICE, created.id);

    const rows = await notes.list(ALICE, 'skt-primer-perry');
    assert.deepEqual(rows, []);
  });

  test('does not remove another user’s note, and does not throw', async () => {
    const bobsNote = await notes.create(BOB, 'skt-primer-perry', "Bob's note.");

    await notes.remove(ALICE, bobsNote.id);

    const rows = await notes.list(BOB, 'skt-primer-perry');
    assert.equal(rows.length, 1, "Alice removing Bob's note id must not delete it");
  });

  test('removing a non-existent id does not throw', async () => {
    await notes.remove(ALICE, 'does-not-exist');
  });
});
