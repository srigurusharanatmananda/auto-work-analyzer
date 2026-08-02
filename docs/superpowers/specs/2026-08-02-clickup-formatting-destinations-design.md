# Standard ClickUp Formatting, Selectable Destinations, and Custom Templates

**Date:** 2026-08-02
**Status:** Approved design, awaiting implementation plan
**Scope:** `auto-work-analyzer` — backend (`src/`) and UI (`ui/`)

## Problem

Three code paths create ClickUp tasks today, and each formats them differently:

| Path | Entry point | Name format | Priority source | Status |
| --- | --- | --- | --- | --- |
| Git analysis | `GitWorkAnalyzer.createTasksFromWork` | emoji prefix + work name | derived from `complexity` | hardcoded `"complete"` |
| Notes upload | `POST /api/notes` → `NotesProcessor` | task title as written | parsed `Priority:` field | parsed `Status:` field |
| Direct creation | `POST /api/create-tasks` | delegates to `GitWorkAnalyzer` | as above | as above |

Nothing is shared between them. A formatting change means three edits, and the next path added will invent a fourth format.

Three further gaps:

1. **Per-user ClickUp settings are stored but never used.** `ui/app/settings/page.tsx` writes `clickup_api_key`, `clickup_team_id`, and `clickup_list_id` into `user_settings`, but every server path constructs `new ClickUpService(config.clickup)` from `.env`. The settings screen is currently decorative. There is no way to target a second workspace or list at all.
2. **No output format is configurable.** `NotesProcessor.generateDescription` bakes `**Task Type:**` and boilerplate bullet lists directly into the description string, so the wire format and the parser are welded together.
3. **Commit grouping is keyword-based.** Work items come out commit-shaped rather than task-shaped. Grouping 180 commits into ~49 meaningful units of work is a semantic problem the current heuristics cannot solve.

## Goals

- One formatting seam that every ClickUp write passes through.
- Tasks can be created into any ClickUp account / workspace / space / folder / list combination, chosen per run.
- Task name and description are driven by user-editable templates with placeholders.
- Commit analysis can emit the same structured markdown format that `NotesProcessor` already consumes, so a report file and the created tasks are the same thing.
- Semantic commit grouping via AI, degrading safely to the existing heuristics.

## Non-goals

- Changing the auth system, the reports/history features, or the analysis UI beyond the pickers described here.
- Two-way sync with ClickUp. This tool creates and updates tasks; it does not mirror ClickUp state back.
- Supporting task trackers other than ClickUp.

## Architecture

```
git │ notes ──→ Source ──→ WorkItem[] ──→ Renderer(template) ─┬─→ TaskData[] ──→ preview
                                                              └─→ markdown   ──→ report file
                                       approve ↓
                          ClickUpWriter(destination) ──→ batched create ──→ results
```

`WorkItem` is the canonical unit. Sources produce it, renderers consume it. Because creation is only reachable through a renderer, standard formatting is enforced by construction rather than by convention.

### Proposed file layout

```
src/domain/WorkItem.ts               canonical type + type guards
src/sources/GitWorkSource.ts         commits → WorkItem[]
src/sources/NotesWorkSource.ts       notes text → WorkItem[]
src/grouping/CommitGrouper.ts        interface
src/grouping/AiCommitGrouper.ts      semantic grouping
src/grouping/HeuristicCommitGrouper.ts   today's keyword logic, extracted
src/ai/AiClient.ts                   provider chain extracted from ManagerSummaryAIService
src/formatting/TemplateEngine.ts     placeholder rendering + validation
src/formatting/ClickUpRenderer.ts    WorkItem[] + Template → TaskData[]
src/formatting/MarkdownRenderer.ts   WorkItem[] + Template → structured markdown
src/formatting/StatusMapper.ts       normalized status → destination's real status
src/formatting/builtinTemplates.ts   seeded read-only templates
src/destinations/DestinationService.ts   CRUD
src/destinations/DestinationResolver.ts  id → { ClickUpService, listId, template }
src/destinations/CredentialCipher.ts     AES-256-GCM
src/routes/destinations.routes.ts
src/routes/templates.routes.ts
src/routes/tasks.routes.ts           preview / create / export
```

`src/webhook-server.ts` is 992 lines and currently defines every endpoint inline. `src/routes/auth.routes.ts` already establishes the extracted-router pattern; the task, notes, and preview endpoints move to `src/routes/tasks.routes.ts` to follow it. This is in scope because those are the endpoints being changed. Unrelated endpoints (`/api/browse`, `/api/history`, `/api/reports`) stay where they are.

## Component 1 — The `WorkItem` domain type

```ts
export type WorkItemType =
  | 'feature' | 'bug-fix' | 'improvement'
  | 'refactor' | 'documentation' | 'test'
  | 'chore' | 'release';

export type WorkItemPriority = 'urgent' | 'high' | 'normal' | 'low';

export interface WorkItemProvenance {
  commits: GitCommit[];        // empty for notes-sourced items
  files: string[];
  repository?: string;
  source: 'git' | 'notes' | 'manual';
}

export interface WorkItem {
  title: string;
  description: string;         // prose only — no markdown scaffolding
  type: WorkItemType;
  priority: WorkItemPriority;
  status?: string;             // normalized; mapped to a real status at write time
  estimateHours: number;
  completedDate?: string;      // ISO yyyy-mm-dd
  tags: string[];
  provenance: WorkItemProvenance;
  subitems?: WorkItem[];
}
```

`description` holds prose only. Everything structural — type labels, emoji, commit lists, "Completed Date:" lines — is a template concern. This is the change that makes formatting configurable at all: today the description string arrives from `NotesProcessor` pre-formatted, so no downstream renderer can alter it without string surgery.

`chore` and `release` are added to the type union because release and version-bump commits are a large fraction of real history and currently land in `improvement`.

## Component 2 — Sources and grouping

`GitWorkSource` wraps the existing commit collection in `GitWorkAnalyzer` and delegates grouping to a `CommitGrouper`:

```ts
export interface CommitGrouper {
  group(commits: GitCommit[], context: GroupingContext): Promise<GroupingResult>;
}

export interface GroupingResult {
  items: WorkItem[];
  mode: 'ai' | 'heuristic';
  fallbackReason?: string;
}
```

`NotesWorkSource` wraps `NotesProcessor`, converting its output to `WorkItem[]` and dropping the generated boilerplate description in favour of the note's own prose.

### `AiCommitGrouper`

Sends the commit set — message, ISO date, author, changed files, insertion/deletion counts — and asks for units of work. The prompt requires:

- each returned item cites the commit hashes it covers, and every input commit is covered exactly once;
- `completedDate` is the date of the item's **latest cited commit**, never invented;
- `title` is a task title, not a commit subject (imperative, no `feat(scope):` prefix);
- `description` states what the problem was, not what the diff did.

The response is validated against a JSON schema. Validation failure, missing coverage, a hallucinated commit hash, a missing API key, or a timeout all fall back to `HeuristicCommitGrouper` with `mode: 'heuristic'` and a `fallbackReason`. The preview surfaces this as *"grouped heuristically — AI unavailable"* so degraded output is never mistaken for the good path.

Large commit sets are chunked by date window to stay inside context limits, with each chunk grouped independently and results concatenated. Chunking is a fixed window rather than a token count; commit metadata is small and a date window keeps related work together.

### `AiClient`

`ManagerSummaryAIService` already implements a provider chain (Gemini flash → Gemini pro → Gemini → Groq → HuggingFace → OpenRouter, each gated on its env key). That chain is extracted into `src/ai/AiClient.ts` with a `complete(prompt, opts)` method, and `ManagerSummaryAIService` is refactored to call it. `AiCommitGrouper` uses the same client, so adding a provider benefits both. `AIDescriptionService` (Gemini-only, primary/fallback model) is left alone — it serves a different feature.

## Component 3 — Templates

### Schema

```sql
CREATE TABLE IF NOT EXISTS task_templates (
  id TEXT PRIMARY KEY,
  user_id TEXT,                      -- NULL for built-ins
  name TEXT NOT NULL,
  description TEXT,
  name_template TEXT NOT NULL,
  description_template TEXT NOT NULL,
  options TEXT NOT NULL,             -- JSON, see below
  is_builtin INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_templates_user ON task_templates(user_id);
```

### Placeholder syntax

Mustache-shaped, rendered by a small purpose-built engine in `TemplateEngine.ts`. No `eval`, no new dependency. Three constructs only:

| Construct | Example |
| --- | --- |
| Scalar | `{{title}}`, `{{typeLabel}}`, `{{priorityLabel}}`, `{{estimateHours}}` |
| Section (iterate or truthy-guard) | `{{#commits}}{{shortHash}} {{message}}{{/commits}}` |
| Inverted section (falsy-guard) | `{{^completedDate}}In progress{{/completedDate}}` |

Available scalars: `title`, `description`, `type`, `typeLabel`, `typeEmoji`, `priority`, `priorityLabel`, `estimateHours`, `status`, `completedDate`, `repository`, `source`, `dateRange`, `commitCount`, `fileCount`.

Available sections: `commits` (fields `hash`, `shortHash`, `date`, `message`, `author`, `insertions`, `deletions`), `files`, `tags`, `subitems` (fields as the scalar set).

Unknown placeholders are a hard error, not an empty string.

### Options

Decisions a template string cannot express:

```ts
export interface TemplateOptions {
  emitSubtasks: boolean;
  applyPriority: boolean;
  applyTimeEstimate: boolean;
  dueDateSource: 'completedDate' | 'lastCommitDate' | 'none';
  statusMode: 'fromWorkItem' | 'destinationDefault' | 'fixed';
  fixedStatus?: string;              // required when statusMode === 'fixed'
  tagStrategy: {
    mode: 'fromWorkItem' | 'none' | 'fixed' | 'merge';
    fixed?: string[];
  };
}
```

### Validation at save time

`POST`/`PUT /api/templates` renders the submitted template against a fixture `WorkItem` before persisting. On failure the response names the offending placeholder and lists the valid ones. A typo must surface in Settings, not as an empty task name in ClickUp three days later.

### Built-in templates

Seeded on migration with `is_builtin = 1`, read-only in the UI with a "Duplicate to edit" action:

- **Standard Work Report** — reproduces the `Task N:` / `Priority:` / `Estimate:` / `Status:` / `Completed:` / `Description:` format that `NotesProcessor` already parses. The default.
- **Terse** — title and one-line description, no provenance.
- **Commit Log** — appends commit hashes, dates, and changed files to the description for audit-heavy work.

## Component 4 — Destinations

### Schema

```sql
CREATE TABLE IF NOT EXISTS clickup_destinations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  api_key_encrypted TEXT NOT NULL,
  team_id TEXT NOT NULL,
  team_name TEXT,
  space_id TEXT,
  space_name TEXT,
  folder_id TEXT,                    -- NULL for folderless lists
  folder_name TEXT,
  list_id TEXT NOT NULL,
  list_name TEXT,
  default_template_id TEXT,
  default_assignee TEXT,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (default_template_id) REFERENCES task_templates(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_destinations_user ON clickup_destinations(user_id);
```

Display names are denormalised alongside ids so the picker can render a saved destination without an API round-trip, and so a destination remains readable if its API key is later revoked.

`is_default` is enforced single-per-user in `DestinationService` by clearing the flag on other rows inside the same transaction.

### Browsing the hierarchy

`ClickUpService` gains:

- `getFolders(spaceId)` — `GET /space/{id}/folder`
- `getListsInFolder(folderId)` — `GET /folder/{id}/list`
- `getFolderlessLists(spaceId)` — `GET /space/{id}/list`
- `getListStatuses(listId)` — from `GET /list/{id}`

Both list endpoints are required: ClickUp permits lists directly under a space with no folder, and a picker that only walks folders silently hides them.

Browse endpoints accept a **candidate credential** — either `destinationId` (use that destination's stored key) or a raw `apiKey` in the request body — so a new destination can be explored before it is saved:

```
POST /api/clickup/teams      { apiKey | destinationId }
POST /api/clickup/spaces     { ..., teamId }
POST /api/clickup/folders    { ..., spaceId }
POST /api/clickup/lists      { ..., spaceId, folderId? }
POST /api/clickup/statuses   { ..., listId }
```

`POST` rather than `GET` because a raw API key must not travel in a query string, where it would land in access logs.

### Status mapping

`"complete"` is not a valid status in every ClickUp list — commit `af716cd` ("remove hardcoded setup status from ClickUp task creation") was a workaround for exactly this. `StatusMapper` resolves it properly:

1. Fetch the destination list's real statuses (cached per list for the request).
2. Exact case-insensitive match wins.
3. Otherwise match through the existing `normalizeStatus` synonym map (`done`/`finished`/`x` → `complete`).
4. Otherwise fuzzy-match with `fastest-levenshtein` (already a dependency) above a similarity threshold.
5. Otherwise **omit `status` from the payload** so ClickUp applies the list default.

The preview reports the mapping it chose per item, including any omission, so a silently-dropped status is visible before creation rather than discovered afterwards.

### Credential encryption

Moving from one key in `.env` to N keys in SQLite makes plaintext storage untenable. `CredentialCipher` uses AES-256-GCM with a key derived from `CREDENTIAL_ENCRYPTION_KEY` (32 bytes, base64). IV and auth tag are stored with the ciphertext.

If `CREDENTIAL_ENCRYPTION_KEY` is absent, the server **refuses to start** with an instruction to generate one. Failing loudly is correct here — the silent alternative is writing credentials in the clear.

There is no numbered migration framework today — `AuthDatabaseService.initializeSchema` creates tables with `CREATE TABLE IF NOT EXISTS` on boot. The new tables follow that pattern. The credential move is data, not schema, so it needs a one-time guarded step (`src/migrations/002-destinations.ts`, recorded in a `schema_migrations` table so it runs once):

1. Create the two new tables and seed built-in templates.
2. For each `user_settings` row with a non-empty `clickup_api_key`, insert a destination named `"Default (migrated)"` with the encrypted key, its `team_id`/`list_id`, and `is_default = 1`.
3. If no user settings exist but `.env` has `CLICKUP_API_KEY`, seed one destination from `.env` for the admin user.
4. Null out `user_settings.clickup_api_key` after successful migration. The column is retained for one release to allow rollback, then dropped.

## Component 5 — API surface

New:

| Method | Path | Purpose |
| --- | --- | --- |
| `GET/POST/PUT/DELETE` | `/api/destinations[/:id]` | destination CRUD |
| `POST` | `/api/destinations/:id/test` | validate credentials and list reachability |
| `GET/POST/PUT/DELETE` | `/api/templates[/:id]` | template CRUD, validated on write |
| `POST` | `/api/templates/preview` | render a template against a fixture or supplied items |
| `POST` | `/api/clickup/{teams,spaces,folders,lists,statuses}` | hierarchy browsing |
| `POST` | `/api/preview-tasks` | render items; **writes nothing** |
| `POST` | `/api/export-markdown` | structured markdown for the items |

Changed:

- `POST /api/create-tasks` accepts optional `destinationId` and `templateId`, and accepts `workItems` directly (the approved preview output) in addition to the existing `workAnalysis` shape.
- `POST /api/notes` accepts optional `destinationId` and `templateId`.

Both keep their current behaviour when the new fields are omitted, resolving to the user's default destination and its default template. No existing caller breaks.

### Preview and approval

`POST /api/preview-tasks` returns, without writing anything:

```ts
{
  items: RenderedTask[],          // exact ClickUp payloads that would be sent
  markdown: string,               // the same content as a structured report
  destination: { id, name, listName, teamName },
  template: { id, name },
  statusMapping: Array<{ from: string, to: string | null, method: string }>,
  grouping: { mode: 'ai' | 'heuristic', fallbackReason?: string },
  warnings: string[]
}
```

UI writes go through this gate: `TaskPreviewModal` gains destination and template pickers and shows the status mapping, and the create call sends back the approved items. The CLI gets `--yes` to skip preview, and `--destination <name>` / `--template <name>`.

## Error handling

| Failure | Behaviour |
| --- | --- |
| Template render error | Whole preview fails, naming the offending placeholder. Nothing is created. |
| Unknown placeholder on template save | `400` listing valid placeholders. Not persisted. |
| Destination credentials invalid (`401`) | `"This destination's API key is invalid or was revoked"`, not a raw fetch error. |
| Target list deleted (`404`) | Named error identifying the destination; suggests re-selecting the list. |
| Status not found in list | Status omitted, recorded in `statusMapping`, surfaced as a preview warning. |
| Rate limit / 5xx | Existing `retryWithBackoff` in `ClickUpService`, unchanged. |
| Per-task creation failure | Isolated. Response carries a partial-failure report of `{ name, reason }`; UI offers retry-failed-only. |
| AI grouping failure | Falls back to heuristic; `mode` and `fallbackReason` returned and displayed. |
| `CREDENTIAL_ENCRYPTION_KEY` missing | Server refuses to start. |

## Testing

The project has no test runner today — `src/test.ts` is a manual configuration smoke script. This adds `bun test` (`bun` is already the package manager) with `bun:test`, and keeps `src/test.ts` as-is.

Load-bearing tests:

- **Markdown round-trip.** `WorkItem[]` → `MarkdownRenderer` → `NotesProcessor.processNotes` → assert the parsed items match the originals on title, priority, estimate, status, and completedDate. This is the mechanical guarantee that an exported report and the tasks created from it are the same format, and it is the single most valuable test here.
- **`TemplateEngine`.** Scalars, sections over empty and non-empty lists, inverted sections, nested sections, unknown-placeholder rejection, and injection safety (a `{{` inside commit text must not be interpreted).
- **`StatusMapper`.** Exact match, synonym match, fuzzy match, below-threshold omission.
- **`CredentialCipher`.** Round-trip, wrong-key failure, tampered-ciphertext failure.
- **`AiCommitGrouper`.** Mocked client returning: valid output, malformed JSON, schema-valid output citing a hallucinated hash, output omitting a commit. The last three must fall back with a reason.
- **`ClickUpRenderer`.** The `TemplateOptions` matrix — each toggle changes exactly the field it claims to.
- **`DestinationService`.** Single-default invariant across concurrent updates.

ClickUp is mocked at `fetch`. No test performs network I/O.

## Implementation slices

Each slice is independently shippable and leaves the app working.

### Slice 1 — Canonical pipeline, templates, markdown export

The `WorkItem` domain type, both sources, `TemplateEngine`, `ClickUpRenderer`, `MarkdownRenderer`, built-in templates, template CRUD and Settings UI, `/api/preview-tasks`, `/api/export-markdown`, and rerouting all three creation paths through the renderer. Still writes to the single `.env`-configured ClickUp.

*Delivers:* one standard format everywhere, editable templates, and commit analysis exported in the structured report format.

### Slice 2 — Destinations

`clickup_destinations`, `CredentialCipher`, `DestinationService`, `DestinationResolver`, the hierarchy browse endpoints, `StatusMapper`, the `002-destinations` data migration, the Destinations tab in Settings, and destination/template pickers in `TaskPreviewModal`.

*Delivers:* create into any account / workspace / space / folder / list, with correct status mapping and encrypted credentials.

*Depends on:* Slice 1, for `default_template_id` to reference.

### Slice 3 — AI grouping

`AiClient` extracted from `ManagerSummaryAIService`, `CommitGrouper` interface, `HeuristicCommitGrouper` extracted from `GitWorkAnalyzer`, `AiCommitGrouper` with schema validation and fallback, chunking, and the grouping-mode indicator in the preview.

*Delivers:* commit analyses grouped into units of work rather than commit-shaped items.

*Depends on:* Slice 1, for `WorkItem`.

## Open risks

- **Template expressiveness versus safety.** The engine deliberately has no arithmetic, filters, or arbitrary expressions. If a real template turns out to need one — date formatting is the likely candidate — the fix is a named scalar (`completedDateLong`), not a general expression language.
- **AI grouping cost.** Grouping 180 commits sends a large prompt. Chunking bounds the per-call size but not the total. Slice 3 should log token usage so cost is observable before it is a surprise.
- **Existing `analysis_history` / `work_items` tables** store the old shape. Slice 1 writes `WorkItem` fields into the existing columns where they correspond and leaves historical rows untouched; reports rendered from old rows keep their old formatting. A backfill is out of scope.
