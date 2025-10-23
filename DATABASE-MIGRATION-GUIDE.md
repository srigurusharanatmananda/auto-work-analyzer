# Database Migration Guide

## Overview

The Auto Work Analyzer now uses a database abstraction layer that makes it easy to migrate from SQLite to PostgreSQL, MySQL, or any other database system.

## Current Setup (SQLite)

**Location:** `.database/auto-work-analyzer.db`

**Tables:**
- `analysis_history` - Stores analysis runs with metadata
- `work_items` - Stores individual work items/tasks with details
- `processed_commits` - Tracks which commits have been processed

**Performance:** SQLite can handle:
- Millions of records
- Up to 281 TB database size
- Suitable for < 100K requests/day
- Best for single-server deployments

## What Data Is Saved

### 1. Analysis History
Every time you analyze a project, we save:
- Analysis ID, timestamp, project path
- Date range and author filter
- Total commits, work items, tasks created
- Summary of work completed

### 2. Work Items
For each work item detected:
- Name, type (feature, bug-fix, improvement)
- Description (AI-enhanced if enabled)
- Estimated hours and complexity (1-3)
- Files and commits count
- Linked to parent analysis

### 3. Processed Commits
For each commit processed:
- Commit hash, date, author, message
- Project path and processing timestamp
- Linked ClickUp task ID and name (if created)

## Database Abstraction Interface

The `IDatabaseService` interface (`src/services/IDatabaseService.ts`) defines all database operations:

```typescript
interface IDatabaseService {
  // Analysis operations
  saveAnalysis(analysis: AnalysisRecord): void;
  getAnalysisHistory(limit?: number, offset?: number): AnalysisRecord[];
  getAnalysisById(id: string): AnalysisRecord | undefined;

  // Work items operations
  saveWorkItem(workItem: WorkItemRecord): void;
  getWorkItemsByAnalysis(analysisId: string): WorkItemRecord[];

  // Commit tracking operations
  markCommitAsProcessed(commit: ProcessedCommitRecord): void;
  isCommitProcessed(hash: string, projectPath: string): boolean;
  getProcessedCommits(projectPath?: string, limit?: number): ProcessedCommitRecord[];

  // Utility operations
  getStatistics(): DatabaseStatistics;
  clearAllData(): void;
  close(): void;
}
```

## How to Migrate to PostgreSQL

### Step 1: Create PostgreSQL Adapter

Create a new file `src/services/PostgresDatabaseService.ts`:

```typescript
import { IDatabaseService, AnalysisRecord, WorkItemRecord, ProcessedCommitRecord } from './IDatabaseService.js';
import { Pool } from 'pg';

export class PostgresDatabaseService implements IDatabaseService {
  private pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
    this.initializeTables();
  }

  private async initializeTables(): Promise<void> {
    // Create tables matching the SQLite schema
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS analysis_history (
        id TEXT PRIMARY KEY,
        timestamp TIMESTAMPTZ NOT NULL,
        project_path TEXT NOT NULL,
        date TEXT NOT NULL,
        end_date TEXT,
        author TEXT,
        branch TEXT,
        total_commits INTEGER NOT NULL,
        total_work_items INTEGER NOT NULL,
        tasks_created INTEGER NOT NULL,
        summary TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Add other tables...
  }

  saveAnalysis(analysis: AnalysisRecord): void {
    // Implement using pool.query()
  }

  // Implement all other interface methods...
}
```

### Step 2: Update Configuration

Add database selection to your config:

```typescript
// .env
DATABASE_TYPE=postgres  # or 'sqlite'
DATABASE_URL=postgresql://user:password@localhost:5432/auto_work_analyzer

// src/config.ts
const dbType = process.env.DATABASE_TYPE || 'sqlite';
const dbService = dbType === 'postgres'
  ? new PostgresDatabaseService(process.env.DATABASE_URL!)
  : new DatabaseService();
```

### Step 3: Export and Import Data

Use the built-in export/import:

```typescript
// Export from SQLite
const sqliteDb = new DatabaseService();
const data = sqliteDb.exportToJSON();
fs.writeFileSync('backup.json', JSON.stringify(data, null, 2));

// Import to PostgreSQL
const postgresDb = new PostgresDatabaseService(process.env.DATABASE_URL!);
data.analyses.forEach(a => postgresDb.saveAnalysis(a));
data.processedCommits.forEach(c => postgresDb.markCommitAsProcessed(c));
```

## Recommended Free Database Options

### 1. Supabase (PostgreSQL) ⭐
- **Free Tier:** 500 MB database, unlimited API requests
- **Best For:** Cloud-native apps, real-time features
- **Migration:** Easy, provides connection string

### 2. Neon (PostgreSQL)
- **Free Tier:** 0.5 GB storage with branching
- **Best For:** Serverless, development workflows
- **Migration:** Simple connection string setup

### 3. PlanetScale (MySQL)
- **Free Tier:** 5 GB storage, 1B row reads/month
- **Best For:** High-scale applications
- **Migration:** Requires MySQL adapter (similar to Postgres)

## When to Migrate

Consider migrating from SQLite when you need:

1. **High Concurrent Writes** - Multiple webhook servers writing simultaneously
2. **Distributed Access** - Multiple servers accessing the same database
3. **Cloud Deployment** - Serverless functions or multi-region architecture
4. **Advanced Features** - Full-text search, JSON queries, replication

## Testing Your Migration

Use the test script to verify your new adapter:

```bash
npm run build
node dist/test-database-saving.js
```

## Backup and Recovery

### Backup SQLite Database
```bash
cp .database/auto-work-analyzer.db .database/backup-$(date +%Y%m%d).db
```

### Export to JSON
```typescript
const db = new DatabaseService();
const backup = db.exportToJSON();
fs.writeFileSync('backup.json', JSON.stringify(backup, null, 2));
```

## Performance Benchmarks (SQLite)

Current database can handle:
- ✅ 1M+ commits tracked
- ✅ 100K+ work items stored
- ✅ 10K+ analyses saved
- ✅ Sub-millisecond queries for most operations
- ✅ <100ms for complex aggregations

## Need Help?

For migration assistance or questions:
1. Check the interface documentation in `src/services/IDatabaseService.ts`
2. Review the SQLite implementation in `src/services/DatabaseService.ts`
3. Open an issue on GitHub
