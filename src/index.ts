/**
 * Auto Work Analyzer
 *
 * Main entry point for the Auto Work Analyzer library.
 * Provides programmatic access to work analysis and ClickUp integration.
 */

export { GitWorkAnalyzer } from "./services/GitWorkAnalyzer.js";
export { ClickUpService } from "./services/ClickUpService.js";
export {
  getAppConfig,
  validateConfig,
  generateSetupInstructions,
} from "./config/index.js";
export {
  interactiveSetup,
  generateGitHooks,
  generateCronJob,
} from "./setup.js";
export { startWebhookServer } from "./webhook-server.js";

export type {
  GitCommit,
  DetectedWork,
  WorkAnalysisResult,
  ClickUpConfig,
  ClickUpTask,
  TaskData,
  ProjectTemplate,
  AnalysisOptions,
  WebhookPayload,
} from "./types/index.js";

/**
 * Quick start function for programmatic usage
 */
export async function analyzeWork(options: {
  date?: string;
  endDate?: string;
  author?: string;
  createTasks?: boolean;
  projectPath?: string;
}): Promise<{
  workAnalysis: any;
  createdTasks?: any[];
}> {
  const { GitWorkAnalyzer } = await import("./services/GitWorkAnalyzer.js");
  const { getAppConfig } = await import("./config/index.js");

  const config = getAppConfig();
  const analyzer = new GitWorkAnalyzer(
    options.projectPath || config.project.path
  );

  const workAnalysis = await analyzer.analyzeWork(
    options.date,
    options.endDate,
    options.author
  );

  let createdTasks = [];
  if (options.createTasks) {
    createdTasks = await analyzer.createTasksFromWork(
      workAnalysis,
      config.clickup
    );
  }

  return {
    workAnalysis,
    createdTasks,
  };
}

/**
 * Create ClickUp tasks from work analysis
 */
export async function createTasksFromWork(
  workAnalysis: any,
  clickupConfig: any
): Promise<any[]> {
  const { GitWorkAnalyzer } = await import("./services/GitWorkAnalyzer.js");
  const analyzer = new GitWorkAnalyzer();

  return await analyzer.createTasksFromWork(workAnalysis, clickupConfig);
}

/**
 * Get ClickUp service instance
 */
export function createClickUpService(config: any) {
  const { ClickUpService } = require("./services/ClickUpService.js");
  return new ClickUpService(config);
}

/**
 * Get Git work analyzer instance
 */
export function createGitWorkAnalyzer(projectPath?: string) {
  const { GitWorkAnalyzer } = require("./services/GitWorkAnalyzer.js");
  return new GitWorkAnalyzer(projectPath);
}

