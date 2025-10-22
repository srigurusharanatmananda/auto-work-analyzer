/**
 * Webhook Server for Auto Work Analyzer
 *
 * Provides HTTP endpoints for automatic work analysis and task creation.
 */

import express from "express";
import cors from "cors";
import helmet from "helmet";
import multer from "multer";
import { GitWorkAnalyzer } from "./services/GitWorkAnalyzer.js";
import { NotesProcessor } from "./services/NotesProcessor.js";
import { getAppConfig, validateConfig } from "./config/index.js";
import { WebhookPayload } from "./types/index.js";
import { ClickUpService } from "./services/ClickUpService.js";

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept text files only
    if (file.mimetype === 'text/plain' || file.originalname.endsWith('.txt') || file.originalname.endsWith('.md')) {
      cb(null, true);
    } else {
      cb(new Error('Only text files (.txt, .md) are allowed'));
    }
  },
});

const app = express();

// Middleware
app.use(helmet({
  contentSecurityPolicy: false,
}));
app.use(cors({
  origin: ['http://localhost:3001', 'http://localhost:3000'],
  credentials: true,
}));
app.use(express.json());

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

    // Health check endpoint
    app.get("/health", (req, res) => {
      res.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        version: "1.0.0",
      });
    });

    // Analyze work endpoint
    app.post("/analyze", async (req, res) => {
      try {
        const { date, endDate, author, createTasks = false } = req.body;

        const analyzer = new GitWorkAnalyzer(config.project.path);
        const workAnalysis = await analyzer.analyzeWork(date, endDate, author);

        let createdTasks = [];
        if (createTasks) {
          createdTasks = await analyzer.createTasksFromWork(
            workAnalysis,
            config.clickup
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

    // Notes upload endpoint
    app.post("/notes", upload.single("notes"), async (req, res) => {
      try {
        let notesText = '';

        // Get notes from file upload or request body
        if (req.file) {
          notesText = req.file.buffer.toString('utf-8');
        } else if (req.body.notes) {
          notesText = req.body.notes;
        } else {
          res.status(400).json({
            success: false,
            error: "No notes provided. Send 'notes' in body or upload a text file.",
          });
          return;
        }

        const { createTasks = false } = req.body;

        // Process the notes
        const notesProcessor = new NotesProcessor();
        const processedNotes = await notesProcessor.processNotes(notesText);

        let createdTasks = [];

        // Create tasks if requested
        if (createTasks && processedNotes.tasks.length > 0) {
          const clickUpService = new ClickUpService(config.clickup);

          for (const task of processedNotes.tasks) {
            try {
              const createdTask = await clickUpService.createTask({
                name: `${
                  task.type === "feature"
                    ? "✨"
                    : task.type === "bug-fix"
                    ? "🐛"
                    : task.type === "test"
                    ? "🧪"
                    : task.type === "documentation"
                    ? "📝"
                    : "🔧"
                } ${task.name}`,
                description: task.description,
                priority:
                  task.complexity === "high"
                    ? "high"
                    : task.complexity === "medium"
                    ? "normal"
                    : "low",
                tags: task.tags,
                timeEstimate: task.estimatedHours * 60 * 60 * 1000, // Convert to milliseconds
              });

              createdTasks.push(createdTask);
            } catch (error) {
              console.error(`Failed to create task: ${task.name}`, error);
            }
          }
        }

        res.json({
          success: true,
          data: {
            processedNotes: {
              totalTasks: processedNotes.tasks.length,
              tasks: processedNotes.tasks.map(task => ({
                name: task.name,
                type: task.type,
                complexity: task.complexity,
                estimatedHours: task.estimatedHours,
                tags: task.tags,
              })),
            },
            createdTasks: createdTasks.map(task => ({
              id: task.id,
              name: task.name,
              url: task.url,
            })),
            summary: {
              tasksExtracted: processedNotes.tasks.length,
              tasksCreated: createdTasks.length,
            },
          },
          message: `Processed ${processedNotes.tasks.length} tasks from notes${
            createTasks ? `, created ${createdTasks.length} ClickUp tasks` : ""
          }`,
        });
      } catch (error) {
        console.error("Notes processing failed:", error);
        res.status(500).json({
          success: false,
          error: "Failed to process notes",
          details: error instanceof Error ? error.message : "Unknown error",
        });
      }
    });

    // Webhook endpoint
    app.post("/webhook", async (req, res) => {
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

        const analyzer = new GitWorkAnalyzer(config.project.path);

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
    app.get("/webhook", (req, res) => {
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
