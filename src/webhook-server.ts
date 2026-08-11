/**
 * Webhook Server for Auto Work Analyzer
 *
 * Provides HTTP endpoints for automatic work analysis and task creation.
 */

import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import fs from "fs";
import path from "path";
import os from "os";
import { execSync } from "child_process";
import { GitWorkAnalyzer } from "./services/GitWorkAnalyzer.js";
import { HistoryService } from "./services/HistoryService.js";
import { AIDescriptionService } from "./services/AIDescriptionService.js";
import { getAppConfig, validateConfig } from "./config/index.js";
import { WebhookPayload } from "./types/index.js";
import authRoutes from "./routes/auth.routes.js";
import { JWTService } from "./services/JWTService.js";
import { anyRole } from "./middleware/policy.js";
import { checkWebhookSecret } from "./middleware/webhookSecret.js";
import { createUsersRouter } from "./routes/users.routes.js";
import { createReportsRouter } from "./routes/reports.routes.js";
import { createTemplatesRouter } from "./routes/templates.routes.js";
import { createLearnRouter } from "./routes/learn.routes.js";
import { createResourcesRouter } from "./routes/resources.routes.js";
import { createTranslateRouter } from "./routes/translate.routes.js";
import { createTasksRouter } from "./routes/tasks.routes.js";
import { TemplateStore } from "./services/TemplateStore.js";
import { CredentialCipher, loadCipherFromEnv } from "./destinations/CredentialCipher.js";
import { DestinationStore } from "./destinations/DestinationStore.js";
import { getPool } from "./db/pool.js";
import type { PostgresHandle } from "./db/client.js";
import { createDestinationsRouter } from "./routes/destinations.routes.js";
import { createClickUpRouter } from "./routes/clickup.routes.js";
import { ScanRegistry } from "./scanning/ScanRegistry.js";
import { DailyScanner } from "./scanning/DailyScanner.js";
import { ScanScheduler } from "./scanning/ScanScheduler.js";
import { createScanningRouter } from "./routes/scanning.routes.js";
import { createTranscriptionRouter } from "./routes/transcription.routes.js";
import { TranscriptionJobStore } from "./transcription/TranscriptionJobStore.js";
import { TranscriptionWorker } from "./transcription/TranscriptionWorker.js";
import { WhisperClient } from "./transcription/WhisperClient.js";
import { AuthDatabaseService } from "./services/AuthDatabaseService.js";
import { DestinationResolver } from "./destinations/DestinationResolver.js";
import { createAiClientFromEnv } from "./ai/AiClient.js";
import { AiCommitGrouper } from "./grouping/AiCommitGrouper.js";
import { HeuristicCommitGrouper } from "./grouping/HeuristicCommitGrouper.js";
import { TranscriptSweeper } from "./calls/TranscriptSweeper.js";
import { LEGACY_COMMIT_OWNER } from "./db/schema.js";
import { authenticate, authenticateOptional } from "./middleware/auth.middleware.js";
import { apiRateLimiter, securityHeaders } from "./middleware/security.middleware.js";

const app = express();

// Middleware
app.use(helmet({
  contentSecurityPolicy: false,
}));
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // Allow localhost and local network IPs
    const allowedPatterns = [
      /^http:\/\/localhost:\d+$/,
      /^http:\/\/127\.0\.0\.1:\d+$/,
      /^http:\/\/192\.168\.\d+\.\d+:\d+$/,
      /^http:\/\/10\.\d+\.\d+\.\d+:\d+$/,
      /^http:\/\/172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+:\d+$/,
    ];

    // Also allow FRONTEND_URL from env if set — the only way this app can be
    // deployed anywhere but localhost, since the patterns above are all
    // localhost/private-IP.
    const isAllowed =
      allowedPatterns.some(pattern => pattern.test(origin)) ||
      (!!process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL);
    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  /**
   * `Range` has to be an allowed REQUEST header or the preflight for a
   * cross-origin `<audio crossorigin>` fails and playback never starts.
   *
   * The exposed RESPONSE headers matter for the same reason. CORS hides every
   * response header except a small safelist, and `Content-Range` is not on it —
   * so a media element loading from another origin cannot work out the length
   * of the resource and leaves the player stuck with `readyState 0`, no
   * duration and a dead scrubber. Nothing errors; it simply never loads.
   */
  allowedHeaders: ['Content-Type', 'Authorization', 'Range'],
  exposedHeaders: ['Content-Range', 'Accept-Ranges', 'Content-Length'],
}));
app.use(express.json());
app.use(cookieParser());
app.use(securityHeaders);
app.use(apiRateLimiter);

// Error handling middleware for JSON parsing errors
app.use((err: any, req: any, res: any, next: any) => {
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({
      success: false,
      error: 'Invalid JSON',
      details: err.message
    });
  }
  next();
});

/**
 * Start webhook server
 */
export async function startWebhookServer(port: number = 3000): Promise<void> {
  try {
    const config = getAppConfig();
    const validation = validateConfig(config);

    if (!validation.isValid) {
      console.error("❌ Configuration invalid:");
      validation.errors.forEach((error) => console.error(`  - ${error}`));
      process.exit(1);
    }

    // Second startup guard, and it must come before any route that issues or
    // accepts a token. JWTService falls back to hard-coded 'change-this-…'
    // secrets, so without this the server boots and happily signs tokens that
    // anyone who has read the source can forge. Refusing to start is the only
    // safe behaviour: a running server with a known secret is worse than none.
    const jwtConfig = JWTService.validateConfig();
    if (!jwtConfig.isValid) {
      console.error("❌ JWT configuration invalid:");
      jwtConfig.errors.forEach((error) => console.error(`  - ${error}`));
      console.error(
        "\n  Set JWT_ACCESS_SECRET and JWT_REFRESH_SECRET in .env to two different\n" +
          "  random strings of at least 32 characters, e.g.\n" +
          "    openssl rand -base64 48"
      );
      process.exit(1);
    }

    // Health check endpoint (public)
    app.get("/api/health", (req, res) => {
      res.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        version: "1.0.0",
      });
    });

    // Authentication routes (public)
    app.use("/api/auth", authRoutes);

    // Admin user management. The only genuinely admin-only surface in the API:
    // every other resource is per-user and bounded by ownership.
    app.use("/api/users", createUsersRouter());

    // Saved analyses. Extracted from inline handlers here so they could be
    // tested at all — this module self-starts a server on import. Every read is
    // scoped to the calling user; see the header of reports.routes.ts.
    app.use("/api", createReportsRouter());

    // Startup guard, deliberately before any store is opened: stored ClickUp
    // keys are encrypted, and there is no "store them in the clear" fallback.
    // An unconfigured install must fail here with instructions rather than
    // discover the problem at the first write.
    let cipher: CredentialCipher;
    try {
      cipher = loadCipherFromEnv();
    } catch (error) {
      console.error(`\u274c ${error instanceof Error ? error.message : error}`);
      process.exit(1);
    }

    // No SQLite here any more. `runMigrations` still exists and still runs — but
    // it belongs to the *import*, not to startup: it operates on a pre-Postgres
    // `.database/auto-work-analyzer.db` that no store reads. It is invoked by
    // `bun run db:import` before the copy, which is the only moment it can
    // still do anything. Leaving the call here would have been dead code
    // wearing the costume of a live migration.

    // Postgres. Opened here, once, and shared by every store that has been
    // ported to it — currently templates and destinations; the rest still read
    // the SQLite file above. Verifying the connection at startup rather than on
    // the first request is deliberate: a server that accepts traffic and then
    // fails every call with a connection error is harder to diagnose than one
    // that refuses to start.
    let pool: PostgresHandle;
    try {
      pool = getPool();
      await pool.sql`SELECT 1`;
    } catch (error) {
      console.error(`\u274c Cannot reach Postgres: ${error instanceof Error ? error.message : error}`);
      console.error(
        "\n  Set DATABASE_URL in .env and apply the schema:\n" +
          "    bun run db:migrate"
      );
      process.exit(1);
    }

    const templateStore = new TemplateStore(pool);
    // Refreshes the read-only built-ins. Under SQLite the constructor did this
    // invisibly on every open; it is explicit now because it is a write, and a
    // write hidden in a constructor is how the schema drifted in the first place.
    await templateStore.seedBuiltins();
    app.use("/api/templates", createTemplatesRouter(templateStore));

    // Sanskrit/Tamil learning module: curriculum, progress and speech, over
    // HTTP. Self-constructs its Postgres- and filesystem-backed dependencies
    // the same way the routers above do — no shared store to pass in here.
    app.use("/api/learn", createLearnRouter());

    // Reading resources for the same two languages, a learner's own notes on
    // each, and a learner's own uploaded books — separate router because it
    // has nothing to do with lesson progress, but same self-constructing-
    // dependencies pattern.
    //
    // Deliberately NOT sharing TRANSCRIPTION_STORAGE_ROOT with the
    // transcription router below, despite both being "where this app keeps
    // files a user gave it": docker-compose.yml bind-mounts that exact host
    // directory, whole, into the Whisper container (see its own comment on
    // why — Whisper opens audio files rather than receiving bytes). Writing
    // uploaded PDFs under that same directory would hand a container that
    // runs third-party model code filesystem access to every user's uploaded
    // books, an unrelated data category it has no business seeing. A
    // different directory name means Whisper's mount simply does not reach
    // it, no docker-compose.yml change required.
    app.use(
      "/api/resources",
      createResourcesRouter({
        storageRoot: path.resolve(process.env.RESOURCE_UPLOADS_ROOT ?? "storage-resources"),
      })
    );

    // Named ClickUp destinations, and the hierarchy browsing the picker needs.
    const destinationStore = new DestinationStore(cipher, pool);
    app.use("/api/destinations", createDestinationsRouter(destinationStore, templateStore));
    app.use("/api/clickup", createClickUpRouter(destinationStore));

    // Every path that creates a ClickUp task. Mounted at "/api" so the legacy
    // paths "/api/notes" and "/api/create-tasks" are preserved exactly; the
    // router owns their formatting now instead of each handler doing its own.
    // `envConfig` is the last fallback in the resolution chain, so a request
    // that names no destination still creates tasks exactly where it used to.
    const resolver = new DestinationResolver({
      destinations: destinationStore,
      templates: templateStore,
      envConfig: config.clickup,
    });

    // Built here, inside startup, rather than at module scope:
    // createAiClientFromEnv reads process.env eagerly, so constructing it before
    // dotenv has loaded would yield an empty provider chain and silently pin
    // every request to the heuristic path with no error to notice.
    // Constructed before the tasks router, which takes the store so that
    // /api/preview-tasks can resolve a `transcriptionJobId` into its transcript.
    const transcriptionStorageRoot = path.resolve(
      process.env.TRANSCRIPTION_STORAGE_ROOT ?? "storage"
    );
    const transcriptionStore = new TranscriptionJobStore(pool);
    const whisperClient = new WhisperClient({ storageRoot: transcriptionStorageRoot });

    const aiClient = createAiClientFromEnv();
    const useAiGrouping = aiClient.isConfigured && process.env.AI_GROUPING !== "false";
    const grouper = useAiGrouping
      ? new AiCommitGrouper(aiClient)
      : new HeuristicCommitGrouper();
    console.log(
      `📦 Commit grouping: ${
        useAiGrouping ? `AI (${aiClient.providerNames.join(", ")})` : "heuristic"
      }`
    );

    // Sanskrit/Tamil <-> English translation, plus transliteration either
    // way — shares the same provider chain commit grouping uses. Mounted
    // here specifically because aiClient does not exist any earlier in
    // startup (see the comment on its own construction above).
    app.use("/api/translate", createTranslateRouter({ aiClient }));

    app.use(
      "/api",
      createTasksRouter({
        resolver,
        defaultProjectPath: config.project.path,
        grouper,
        // The same provider chain the grouper uses, so a transcript posted to
        // /api/preview-tasks can be turned into action items.
        aiClient,
        transcriptionJobs: transcriptionStore,
      })
    );

    // Org-wide daily scan. Shares the one database, so a repo binding and the
    // destination it names cannot land in different files.
    const scanRegistry = new ScanRegistry(pool);
    const dailyScanner = new DailyScanner({
      registry: scanRegistry,
      resolver,
      grouper,
    });

    app.use(
      "/api/scanning",
      createScanningRouter({ registry: scanRegistry, scanner: dailyScanner })
    );

    /**
     * Assigned below, once the transcription store exists. Declared here so the
     * scheduler's `runScan` can close over it: the daily tick is the natural
     * place to file yesterday's calls, and giving transcripts a second timer
     * would mean two unattended writers to ClickUp on different schedules.
     */
    let transcriptSweeper: TranscriptSweeper | undefined;

    const scanScheduler = new ScanScheduler({
      registry: scanRegistry,
      userIds: async () => {
        // getAllUsers is paginated with a default limit of 50; pass an explicit
        // large limit so a growing user table does not silently stop being
        // scheduled past the first page.
        const users = new AuthDatabaseService(pool);
        try {
          return (await users.getAllUsers(10_000, 0)).map((user) => user.id);
        } finally {
          users.close();
        }
      },
      runScan: async (userId, date) => {
        const summary = await dailyScanner.run(userId, { date });
        // Persist the summary BEFORE marking the day complete: it is the only
        // record a scheduled run leaves, and it must survive even if the settings
        // write fails.
        await scanRegistry.saveRun(userId, summary);
        await scanRegistry.saveSettings(userId, { lastCompletedDate: date });
        console.log(
          `📅 Daily scan ${date}: ${summary.totalTasksCreated} task(s) across ${summary.repos.length} repo(s)`
        );

        // Calls that finished transcribing since the last tick. Deliberately
        // after the git scan and inside the same try-free block the scheduler
        // already wraps: a sweep that throws must not stop the day being
        // recorded as scanned, or every subsequent tick would redo the scan.
        if (!transcriptSweeper) return;
        try {
          const sweep = await transcriptSweeper.run(userId, { dryRun: false });
          if (sweep.jobs.length > 0) {
            console.log(
              `🎙️  Transcript sweep: ${sweep.totalTasksCreated} task(s) from ${sweep.jobs.length} recording(s)`
            );
          }
        } catch (error) {
          console.error("Transcript sweep failed:", error);
        }
      },
    });
    scanScheduler.start();

    // ---- Transcription: audio -> transcript ----
    //
    // The worker runs in this process. On 8 GB only one transcription can run at
    // a time regardless, so a separate process would add something to start
    // without enabling concurrency we could afford.
    //
    // `TRANSCRIPTION_STORAGE_ROOT` must be the host directory bind-mounted into
    // the Whisper container as /storage. Defaults to ./storage, matching
    // docker-compose. Whisper opens the file itself rather than receiving bytes,
    // so a mismatch here means nothing can be transcribed — the upload route
    // checks it up front and 500s rather than queueing work that cannot run.
    // Only when a provider exists: without one every sweep would fail at the
    // first extraction, and an unattended job that can only fail is worse than
    // an absent one. The route says so explicitly rather than 404ing.
    transcriptSweeper = aiClient.isConfigured
      ? new TranscriptSweeper({ store: transcriptionStore, resolver, aiClient })
      : undefined;

    app.use(
      "/api/transcription",
      createTranscriptionRouter({
        store: transcriptionStore,
        storageRoot: transcriptionStorageRoot,
        whisper: whisperClient,
        sweeper: transcriptSweeper,
      })
    );

    const transcriptionWorker = new TranscriptionWorker({
      store: transcriptionStore,
      whisper: whisperClient,
      pg: pool,
      onSettled: (job, outcome) =>
        console.log(`🎙️  Transcription ${outcome}: ${job.originalFilename} (${job.id})`),
    });

    // Failure to start is logged, not fatal: uploads still queue, and the work
    // is picked up whenever a worker next runs. Refusing to boot the whole API
    // because Whisper is down would take the git-analysis half offline too.
    await transcriptionWorker.start().catch((error) => {
      console.error("Transcription worker failed to start:", error);
    });

    // Finish in-flight work rather than abandoning it — a killed job wastes the
    // minutes already spent and leaves a claim to reclaim later.
    //
    // The scan is stopped alongside the transcription for the same reason and
    // one more: a scan killed partway has already created some of its ClickUp
    // tasks, and its lease then sits held until the TTL lapses, blocking the
    // retry that would finish the job.
    for (const signal of ["SIGINT", "SIGTERM"] as const) {
      process.once(signal, () => {
        console.log(`\n${signal} received — finishing in-flight work...`);
        void Promise.allSettled([transcriptionWorker.stop(), scanScheduler.stop()]).finally(() =>
          process.exit(0)
        );
      });
    }

    // Browse directories endpoint
    app.get("/api/browse", authenticate, anyRole, (req, res) => {
      try {
        const requestedPath = (req.query.path as string) || os.homedir();

        // Security: Prevent directory traversal attacks
        const normalizedPath = path.normalize(requestedPath);

        // Check if path exists and is a directory
        if (!fs.existsSync(normalizedPath)) {
          res.status(404).json({
            success: false,
            error: "Path does not exist",
          });
          return;
        }

        const stats = fs.statSync(normalizedPath);
        if (!stats.isDirectory()) {
          res.status(400).json({
            success: false,
            error: "Path is not a directory",
          });
          return;
        }

        // Read directory contents
        const items = fs.readdirSync(normalizedPath, { withFileTypes: true });

        // Filter and format results
        const directories = items
          .filter(item => item.isDirectory() && !item.name.startsWith('.'))
          .map(item => ({
            name: item.name,
            path: path.join(normalizedPath, item.name),
            isGitRepo: fs.existsSync(path.join(normalizedPath, item.name, '.git'))
          }))
          .sort((a, b) => a.name.localeCompare(b.name));

        // Get parent directory
        const parentPath = path.dirname(normalizedPath);
        const canGoUp = normalizedPath !== path.parse(normalizedPath).root;

        res.json({
          success: true,
          data: {
            currentPath: normalizedPath,
            parentPath: canGoUp ? parentPath : null,
            directories,
            gitRepos: directories.filter(d => d.isGitRepo).length
          }
        });
      } catch (error) {
        console.error("Browse error:", error);
        res.status(500).json({
          success: false,
          error: "Failed to browse directory",
          details: error instanceof Error ? error.message : "Unknown error",
        });
      }
    });

    // AI Enhancement endpoint - enhance work item description with Claude
    app.post("/api/ai-enhance", authenticate, anyRole, async (req, res) => {
      try {
        const { workItemName, description, commits, filesChanged } = req.body;

        if (!workItemName) {
          res.status(400).json({
            success: false,
            error: "workItemName is required",
          });
          return;
        }

        // Check if API key is configured
        if (!process.env.GOOGLE_API_KEY || process.env.GOOGLE_API_KEY === 'your_google_api_key_here') {
          res.status(400).json({
            success: false,
            error: "Google API key not configured. Please add GOOGLE_API_KEY to your .env file.",
          });
          return;
        }

        const aiService = new AIDescriptionService();
        const enhanced = await aiService.enhanceWorkItemDescription(
          workItemName,
          description || '',
          commits || [],
          filesChanged || []
        );

        res.json({
          success: true,
          data: enhanced,
        });
      } catch (error) {
        console.error("AI enhancement failed:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";

        // Provide user-friendly error messages
        let userMessage = "Failed to enhance description";
        if (errorMessage.includes('overloaded')) {
          userMessage = "AI service is currently overloaded. The system will retry automatically.";
        } else if (errorMessage.includes('rate limit')) {
          userMessage = "Rate limit exceeded. Please wait a moment and try again.";
        } else if (errorMessage.includes('API key')) {
          userMessage = "API key issue. Please check your configuration.";
        }

        res.status(500).json({
          success: false,
          error: userMessage,
          details: errorMessage,
        });
      }
    });

    // Generate manager-friendly summary from work items
    app.post("/api/manager-summary", authenticate, anyRole, async (req, res) => {
      try {
        const { workItems, reportDate } = req.body;

        if (!workItems || !Array.isArray(workItems) || workItems.length === 0) {
          res.status(400).json({
            success: false,
            error: "workItems array is required and must not be empty",
          });
          return;
        }

        // Use the multi-provider AI service with automatic fallback
        const { ManagerSummaryAIService } = await import('./services/ManagerSummaryAIService.js');
        const aiService = new ManagerSummaryAIService();

        const configuredProviders = aiService.getConfiguredProviders();
        console.log(`📋 Available AI providers: ${configuredProviders.join(', ')}`);

        const summary = await aiService.generateManagerSummary(workItems, reportDate);

        res.json({
          success: true,
          data: {
            summary,
          },
        });
      } catch (error) {
        console.error("Manager summary generation failed:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";

        // Provide user-friendly error messages
        let userMessage = "Failed to generate manager summary";
        if (errorMessage.includes('No AI providers configured')) {
          userMessage = errorMessage; // Show the helpful setup message
        } else if (errorMessage.includes('All AI providers failed')) {
          userMessage = "All available AI providers failed. Please try again later or check your API keys.";
        } else if (errorMessage.includes('overloaded')) {
          userMessage = "AI service is currently overloaded. Please try again in a moment.";
        } else if (errorMessage.includes('rate limit')) {
          userMessage = "Rate limit exceeded. Trying alternative providers...";
        }

        res.status(500).json({
          success: false,
          error: userMessage,
          details: errorMessage,
        });
      }
    });

    // Git info endpoint - fetch branches and user info
    app.get("/api/git-info", authenticate, anyRole, (req, res) => {
      try {
        const projectPath = (req.query.path as string) || process.cwd();

        // Validate path exists and is a directory
        if (!fs.existsSync(projectPath) || !fs.statSync(projectPath).isDirectory()) {
          res.status(400).json({
            success: false,
            error: "Invalid project path",
          });
          return;
        }

        // Check if it's a git repository
        const gitDir = path.join(projectPath, '.git');
        if (!fs.existsSync(gitDir)) {
          res.status(400).json({
            success: false,
            error: "Not a git repository",
          });
          return;
        }

        try {
          // Get all branches
          const branchesOutput = execSync('git branch -a', {
            cwd: projectPath,
            encoding: 'utf-8',
          });

          const branches = branchesOutput
            .split('\n')
            .map((line) => line.trim().replace(/^\*\s+/, '').replace(/^remotes\/origin\//, ''))
            .filter((branch) => branch && !branch.includes('HEAD'))
            .filter((branch, index, self) => self.indexOf(branch) === index); // Remove duplicates

          // Get current branch
          const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', {
            cwd: projectPath,
            encoding: 'utf-8',
          }).trim();

          // Get current user email
          let userEmail = '';
          try {
            userEmail = execSync('git config user.email', {
              cwd: projectPath,
              encoding: 'utf-8',
            }).trim();
          } catch (e) {
            // If local config doesn't exist, try global
            try {
              userEmail = execSync('git config --global user.email', {
                encoding: 'utf-8',
              }).trim();
            } catch (e2) {
              // No git user email configured
              userEmail = '';
            }
          }

          // Get current user name
          let userName = '';
          try {
            userName = execSync('git config user.name', {
              cwd: projectPath,
              encoding: 'utf-8',
            }).trim();
          } catch (e) {
            try {
              userName = execSync('git config --global user.name', {
                encoding: 'utf-8',
              }).trim();
            } catch (e2) {
              userName = '';
            }
          }

          res.json({
            success: true,
            data: {
              branches,
              currentBranch,
              userEmail,
              userName,
              projectPath,
            },
          });
        } catch (gitError) {
          console.error('Git command failed:', gitError);
          res.status(500).json({
            success: false,
            error: 'Failed to get git information',
            details: gitError instanceof Error ? gitError.message : 'Unknown error',
          });
        }
      } catch (error) {
        console.error('Git info fetch failed:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to fetch git information',
          details: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // Analyze work endpoint (protected - requires authentication)
    app.post("/api/analyze", authenticate, anyRole, async (req, res) => {
      try {
        const { date, endDate, author, branch, createTasks = false, projectPath } = req.body;

        // Use provided project path or default from config
        const targetProjectPath = projectPath || config.project.path;

        // `grouper` is what makes AI grouping reachable from the product: this
        // is the endpoint the UI's whole flow starts from, and before it was
        // passed here the injected grouper had no consumer any client could hit.
        const analyzer = new GitWorkAnalyzer(
          targetProjectPath,
          undefined,
          grouper,
          // Dedup is per user: whether a commit is "already filed" is a claim
          // about THIS caller's ClickUp list.
          (req as any).user!.userId
        );
        // Include processed commits for reports (createTasks = false)
        // Only filter processed commits when creating tasks to prevent duplicates
        const includeProcessed = !createTasks;
        const workAnalysis = await analyzer.analyzeWork(date, endDate, author, branch, includeProcessed);

        let createdTasks = [];
        if (createTasks) {
          createdTasks = await analyzer.createTasksFromWork(
            workAnalysis,
            config.clickup
          );
        }

        // Save analysis to database
        const historyService = new HistoryService();
        const analysisId = await historyService.addAnalysisHistory(req.user!.userId, {
          projectPath: targetProjectPath,
          date: workAnalysis.date,
          endDate: endDate || undefined,
          author: author || undefined,
          totalCommits: workAnalysis.totalCommits,
          totalWorkItems: workAnalysis.detectedWork.length,
          tasksCreated: createdTasks.length,
          summary: workAnalysis.summary,
        });

        // Save all work items to database
        for (const work of workAnalysis.detectedWork) {
          await historyService.saveWorkItem(
            analysisId,
            work.name,
            work.type,
            work.description,
            work.estimatedHours,
            work.complexity,
            work.files.length,
            work.commits.length
          );
        }

        res.json({
          success: true,
          data: {
            workAnalysis,
            createdTasks,
            summary: {
              date: workAnalysis.date,
              totalCommits: workAnalysis.totalCommits,
              totalWorkItems: workAnalysis.detectedWork.length,
              totalFilesChanged: workAnalysis.totalFilesChanged,
              totalLinesChanged:
                workAnalysis.totalLinesAdded + workAnalysis.totalLinesDeleted,
              tasksCreated: createdTasks.length,
            },
          },
          message: `Work analysis completed for ${workAnalysis.date}`,
        });
      } catch (error) {
        console.error("Analysis failed:", error);
        res.status(500).json({
          success: false,
          error: "Failed to analyze work",
          details: error instanceof Error ? error.message : "Unknown error",
        });
      }
    });

    // Webhook endpoint
    app.post("/api/webhook", async (req, res) => {
      try {
        const {
          type,
          project,
          date,
          endDate,
          author,
          branch,
          repository,
          commitHash,
          secret,
        }: WebhookPayload = req.body;

        // This endpoint creates real ClickUp tasks and has no user session, so
        // the shared secret is the only thing standing in front of it. An unset
        // WEBHOOK_SECRET disables the endpoint rather than opening it — see
        // src/middleware/webhookSecret.ts.
        const secretCheck = checkWebhookSecret(config.webhook.secret, secret);
        if (!secretCheck.ok) {
          res.status(secretCheck.status).json({
            success: false,
            error: secretCheck.error,
          });
          return;
        }

        console.log("Webhook triggered:", {
          type,
          project,
          date,
          author,
          branch,
          repository,
          commitHash,
        });

        // LEGACY_COMMIT_OWNER, explicitly: this endpoint is authenticated by a
        // shared secret and has no user session (see above), so there is no
        // per-user ledger to use. Written out rather than left to the default so
        // the choice is visible at the call site.
        const analyzer = new GitWorkAnalyzer(
          config.project.path,
          undefined,
          grouper,
          LEGACY_COMMIT_OWNER
        );

        // Determine date range based on webhook type
        let analysisDate = date;
        let analysisEndDate = endDate;

        if (type === "git-push" && !date) {
          // For git push, analyze today's work
          analysisDate = new Date().toISOString().split("T")[0];
        } else if (type === "scheduled" && !date) {
          // For scheduled runs, analyze yesterday's work
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          analysisDate = yesterday.toISOString().split("T")[0];
        }

        // Analyze work
        const workAnalysis = await analyzer.analyzeWork(
          analysisDate,
          analysisEndDate,
          author
        );

        // Create tasks if there's actual work detected
        let createdTasks = [];
        if (workAnalysis.detectedWork.length > 0) {
          createdTasks = await analyzer.createTasksFromWork(
            workAnalysis,
            config.clickup
          );
          console.log(`Created ${createdTasks.length} tasks from webhook`);
        }

        res.json({
          success: true,
          data: {
            webhook: {
              type,
              project,
              date: analysisDate,
              branch,
              repository,
              commitHash,
            },
            workAnalysis,
            createdTasks,
            summary: {
              totalCommits: workAnalysis.totalCommits,
              totalWorkItems: workAnalysis.detectedWork.length,
              tasksCreated: createdTasks.length,
              hasWork: workAnalysis.detectedWork.length > 0,
            },
          },
          message: `Webhook processed successfully for ${type}`,
        });
      } catch (error) {
        console.error("Webhook processing failed:", error);
        res.status(500).json({
          success: false,
          error: "Webhook processing failed",
          details: error instanceof Error ? error.message : "Unknown error",
        });
      }
    });

    // Get webhook info
    app.get("/api/webhook", (req, res) => {
      res.json({
        success: true,
        data: {
          webhook: {
            status: "active",
            supportedTypes: ["git-push", "scheduled", "manual", "ci-cd"],
            endpoints: {
              "POST /analyze": "Analyze work and optionally create tasks",
              "POST /notes": "Upload notes and convert to tasks",
              "POST /webhook": "Webhook endpoint for automatic analysis",
              "GET /webhook": "Get webhook information",
              "GET /health": "Health check",
            },
            usage: {
              gitPush: {
                description: "Triggered automatically on git push",
                payload: {
                  type: "git-push",
                  project: "my-project",
                  branch: "main",
                  repository: "your-repo",
                  commitHash: "abc123",
                },
              },
              scheduled: {
                description: "Triggered by scheduled job (cron, etc.)",
                payload: {
                  type: "scheduled",
                  project: "my-project",
                  date: "2024-01-15",
                },
              },
              manual: {
                description: "Manual trigger for specific date range",
                payload: {
                  type: "manual",
                  project: "my-project",
                  date: "2024-01-15",
                  endDate: "2024-01-16",
                  author: "developer@example.com",
                },
              },
              notes: {
                description: "Upload notes and convert to tasks",
                payload: {
                  notes: "- Add authentication\n- Fix bug in payment flow\n- Improve performance",
                  createTasks: true,
                },
                note: "Can also upload file using multipart/form-data with 'notes' field",
              },
            },
          },
        },
        message: "Webhook endpoint ready",
      });
    });

    // Global error handler - must be last
    app.use((err: any, req: any, res: any, next: any) => {
      console.error('Server error:', err);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: err.message || 'An unexpected error occurred',
      });
    });

    // Start server
    app.listen(port, () => {
      console.log(
        `🚀 Auto Work Analyzer webhook server running on port ${port}`
      );
      console.log(`📡 Health check: http://localhost:${port}/health`);
      console.log(`🔗 Webhook endpoint: http://localhost:${port}/webhook`);
      console.log(`📊 Analysis endpoint: http://localhost:${port}/analyze`);
      console.log(`📝 Notes endpoint: http://localhost:${port}/notes`);
      console.log("\nPress Ctrl+C to stop the server");
    });
  } catch (error) {
    console.error("Failed to start webhook server:", error);
    process.exit(1);
  }
}

// Start the server if this file is run directly
const config = getAppConfig();
const port = config.webhook.port || 3000;
// Caught rather than left floating: a startup failure — a refused database, a
// missing secret — should say so and exit non-zero, not surface as an unhandled
// rejection whose stack points at the runtime.
startWebhookServer(port).catch((error: unknown) => {
  console.error("Failed to start:", error instanceof Error ? error.message : error);
  process.exit(1);
});
