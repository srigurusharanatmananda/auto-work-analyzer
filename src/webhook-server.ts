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
import { createTemplatesRouter } from "./routes/templates.routes.js";
import { createTasksRouter } from "./routes/tasks.routes.js";
import { TemplateStore } from "./services/TemplateStore.js";
import { CredentialCipher, loadCipherFromEnv } from "./destinations/CredentialCipher.js";
import { runMigrations } from "./migrations/runMigrations.js";
import { DestinationStore } from "./destinations/DestinationStore.js";
import { createDestinationsRouter } from "./routes/destinations.routes.js";
import { createClickUpRouter } from "./routes/clickup.routes.js";
import { DestinationResolver } from "./destinations/DestinationResolver.js";
import { createAiClientFromEnv } from "./ai/AiClient.js";
import { AiCommitGrouper } from "./grouping/AiCommitGrouper.js";
import { HeuristicCommitGrouper } from "./grouping/HeuristicCommitGrouper.js";
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

    const isAllowed = allowedPatterns.some(pattern => pattern.test(origin));
    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
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

    // One database for everything (same .database/auto-work-analyzer.db as
    // AuthDatabaseService), so a destination and the user it belongs to cannot
    // end up in different files.
    const databaseDir = path.join(process.cwd(), ".database");
    if (!fs.existsSync(databaseDir)) {
      fs.mkdirSync(databaseDir, { recursive: true });
    }
    const dbPath = path.join(databaseDir, "auto-work-analyzer.db");

    // Startup guard, deliberately before any store is opened: stored ClickUp
    // keys are encrypted, and there is no "store them in the clear" fallback.
    // An unconfigured install must fail here with instructions rather than
    // discover the problem at the first write.
    let cipher: CredentialCipher;
    try {
      cipher = loadCipherFromEnv();
    } catch (error) {
      console.error(`❌ ${error instanceof Error ? error.message : error}`);
      process.exit(1);
    }
    runMigrations(dbPath, cipher);

    const templateStore = new TemplateStore(dbPath);
    app.use("/api/templates", createTemplatesRouter(templateStore));

    // Named ClickUp destinations, and the hierarchy browsing the picker needs.
    const destinationStore = new DestinationStore(dbPath, cipher);
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

    app.use(
      "/api",
      createTasksRouter({
        resolver,
        defaultProjectPath: config.project.path,
        grouper,
      })
    );

    // Browse directories endpoint
    app.get("/api/browse", authenticate, (req, res) => {
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

    // History endpoint
    app.get("/api/history", authenticate, (req, res) => {
      try {
        const historyService = new HistoryService();
        const limit = parseInt(req.query.limit as string) || 50;

        const history = historyService.getAnalysisHistory(limit);
        const stats = historyService.getStatistics();

        res.json({
          success: true,
          data: {
            history,
            statistics: stats,
          },
        });
      } catch (error) {
        console.error("Failed to get history:", error);
        res.status(500).json({
          success: false,
          error: "Failed to retrieve history",
          details: error instanceof Error ? error.message : "Unknown error",
        });
      }
    });

    // AI Enhancement endpoint - enhance work item description with Claude
    app.post("/api/ai-enhance", authenticate, async (req, res) => {
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
    app.post("/api/manager-summary", authenticate, async (req, res) => {
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
    app.get("/api/git-info", authenticate, (req, res) => {
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
    app.post("/api/analyze", authenticate, async (req, res) => {
      try {
        const { date, endDate, author, branch, createTasks = false, projectPath } = req.body;

        // Use provided project path or default from config
        const targetProjectPath = projectPath || config.project.path;

        // `grouper` is what makes AI grouping reachable from the product: this
        // is the endpoint the UI's whole flow starts from, and before it was
        // passed here the injected grouper had no consumer any client could hit.
        const analyzer = new GitWorkAnalyzer(targetProjectPath, undefined, grouper);
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
        const analysisId = historyService.addAnalysisHistory({
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
          historyService.saveWorkItem(
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

    // Save report endpoint
    app.post("/api/save-report", authenticate, async (req, res) => {
      try {
        const { projectPath, date, endDate, author, branch, workItems, summary } = req.body;

        if (!projectPath || !date || !workItems || !Array.isArray(workItems)) {
          res.status(400).json({
            success: false,
            error: "Missing required fields: projectPath, date, and workItems array are required",
          });
          return;
        }

        const historyService = new HistoryService();

        // Save analysis to database
        const analysisId = historyService.addAnalysisHistory({
          projectPath,
          date,
          endDate,
          author,
          totalCommits: summary?.totalCommits || 0,
          totalWorkItems: workItems.length,
          tasksCreated: 0, // Reports don't create tasks
          summary: summary?.summary || `Report generated for ${date}`,
        });

        // Save all work items
        let savedCount = 0;
        for (const item of workItems) {
          if (item.name && item.type) {
            historyService.saveWorkItem(
              analysisId,
              item.name,
              item.type,
              item.description || '',
              item.estimatedHours || 0,
              item.complexity || 'medium',
              item.filesCount || 0,
              item.commitsCount || 0
            );
            savedCount++;
          }
        }

        historyService.close();

        res.json({
          success: true,
          data: {
            analysisId,
            savedWorkItems: savedCount,
          },
          message: `Report saved successfully with ${savedCount} work items`,
        });
      } catch (error) {
        console.error("Failed to save report:", error);
        res.status(500).json({
          success: false,
          error: "Failed to save report",
          details: error instanceof Error ? error.message : "Unknown error",
        });
      }
    });

    // Get saved reports endpoint
    app.get("/api/reports", authenticate, async (req, res) => {
      try {
        const limit = parseInt(req.query.limit as string) || 10;
        const offset = parseInt(req.query.offset as string) || 0;

        const { DatabaseService } = await import('./services/DatabaseService.js');
        const db = new DatabaseService();

        const reports = db.getPaginatedReports(limit, offset);
        const stats = db.getStatistics();

        db.close();

        res.json({
          success: true,
          data: {
            reports,
            hasMore: reports.length === limit, // If we got a full page, there might be more
            total: stats.totalAnalyses,
          },
        });
      } catch (error) {
        console.error("Failed to get reports:", error);
        res.status(500).json({
          success: false,
          error: "Failed to retrieve reports",
          details: error instanceof Error ? error.message : "Unknown error",
        });
      }
    });

    // Get single report by ID
    app.get("/api/reports/:id", authenticate, async (req, res) => {
      try {
        const { id } = req.params;

        const { DatabaseService } = await import('./services/DatabaseService.js');
        const db = new DatabaseService();

        const report = db.getCompleteReport(id);
        db.close();

        if (!report) {
          res.status(404).json({
            success: false,
            error: "Report not found",
          });
          return;
        }

        res.json({
          success: true,
          data: report,
        });
      } catch (error) {
        console.error("Failed to get report:", error);
        res.status(500).json({
          success: false,
          error: "Failed to retrieve report",
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

        // Verify webhook secret if provided
        if (config.webhook.secret && secret !== config.webhook.secret) {
          res.status(401).json({
            success: false,
            error: "Invalid webhook secret",
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

        const analyzer = new GitWorkAnalyzer(config.project.path, undefined, grouper);

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
startWebhookServer(port);
