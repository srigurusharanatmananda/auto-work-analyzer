/**
 * Migration script to move data from JSON files to SQLite database
 */

import fs from 'fs';
import path from 'path';
import { DatabaseService } from './services/DatabaseService.js';

interface JSONAnalysisHistory {
  id: string;
  timestamp: string;
  projectPath: string;
  date: string;
  endDate?: string;
  author?: string;
  totalCommits: number;
  totalWorkItems: number;
  tasksCreated: number;
  summary: string;
}

interface JSONProcessedCommit {
  hash: string;
  date: string;
  author: string;
  message: string;
  processedAt: string;
  projectPath: string;
  taskId?: string;
  taskName?: string;
}

async function migrateToDatabase() {
  console.log('🔄 Starting migration from JSON to SQLite database...\n');

  const historyDir = path.join(process.cwd(), '.history');
  const analysisHistoryFile = path.join(historyDir, 'analysis-history.json');
  const processedCommitsFile = path.join(historyDir, 'processed-commits.json');

  // Check if JSON files exist
  const hasAnalysisHistory = fs.existsSync(analysisHistoryFile);
  const hasProcessedCommits = fs.existsSync(processedCommitsFile);

  if (!hasAnalysisHistory && !hasProcessedCommits) {
    console.log('✅ No JSON files found. Starting fresh with database.');
    console.log(`   Database will be created at: ${path.join(process.cwd(), '.database/auto-work-analyzer.db')}`);
    return;
  }

  const db = new DatabaseService();

  let totalAnalyses = 0;
  let totalCommits = 0;

  // Migrate analysis history
  if (hasAnalysisHistory) {
    try {
      console.log('📊 Migrating analysis history...');
      const data = fs.readFileSync(analysisHistoryFile, 'utf-8');
      const analyses: JSONAnalysisHistory[] = JSON.parse(data);

      for (const analysis of analyses) {
        await db.saveAnalysis({
          id: analysis.id,
          timestamp: analysis.timestamp,
          projectPath: analysis.projectPath,
          date: analysis.date,
          endDate: analysis.endDate,
          author: analysis.author,
          totalCommits: analysis.totalCommits,
          totalWorkItems: analysis.totalWorkItems,
          tasksCreated: analysis.tasksCreated,
          summary: analysis.summary,
        });
        totalAnalyses++;
      }

      console.log(`   ✅ Migrated ${totalAnalyses} analysis records`);
    } catch (error) {
      console.error('   ❌ Error migrating analysis history:', error);
    }
  }

  // Migrate processed commits
  if (hasProcessedCommits) {
    try {
      console.log('📝 Migrating processed commits...');
      const data = fs.readFileSync(processedCommitsFile, 'utf-8');
      const commits: JSONProcessedCommit[] = JSON.parse(data);

      for (const commit of commits) {
        await db.markCommitAsProcessed({
          hash: commit.hash,
          date: commit.date,
          author: commit.author,
          message: commit.message,
          projectPath: commit.projectPath,
          processedAt: commit.processedAt,
          taskId: commit.taskId,
          taskName: commit.taskName,
        });
        totalCommits++;
      }

      console.log(`   ✅ Migrated ${totalCommits} processed commits`);
    } catch (error) {
      console.error('   ❌ Error migrating processed commits:', error);
    }
  }

  // Show statistics
  // A one-off CLI migration of pre-multi-user data: there is no caller to
  // scope to, and the point is the whole-database total.
  const stats = await db.globalStatisticsUnscoped();

  // Create backup of JSON files
  if (hasAnalysisHistory || hasProcessedCommits) {
    const backupDir = path.join(historyDir, 'json-backup');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    if (hasAnalysisHistory) {
      const backupFile = path.join(backupDir, `analysis-history-${Date.now()}.json`);
      fs.copyFileSync(analysisHistoryFile, backupFile);
    }

    if (hasProcessedCommits) {
      const backupFile = path.join(backupDir, `processed-commits-${Date.now()}.json`);
      fs.copyFileSync(processedCommitsFile, backupFile);
    }

  }

  db.close();

  console.log('\n✅ Migration completed successfully!');
  console.log(`   Database location: ${process.env.DATABASE_URL ?? "(DATABASE_URL unset)"}`);
  console.log('\n🚀 You can now restart your webhook server to use the new database.');
}

// Run migration
migrateToDatabase().catch((error) => {
  console.error('❌ Migration failed:', error);
  process.exit(1);
});
