/**
 * Auto Work Analyzer
 *
 * Main entry point for the Auto Work Analyzer library.
 * Provides programmatic access to work analysis and ClickUp integration.
 */
export { GitWorkAnalyzer } from "./services/GitWorkAnalyzer.js";
export { ClickUpService } from "./services/ClickUpService.js";
export { getAppConfig, validateConfig, generateSetupInstructions, } from "./config/index.js";
export { interactiveSetup, generateGitHooks, generateCronJob, } from "./setup.js";
export { startWebhookServer } from "./webhook-server.js";
export type { GitCommit, DetectedWork, WorkAnalysisResult, ClickUpConfig, ClickUpTask, TaskData, ProjectTemplate, AnalysisOptions, WebhookPayload, } from "./types/index.js";
/**
 * Quick start function for programmatic usage
 */
export declare function analyzeWork(options: {
    date?: string;
    endDate?: string;
    author?: string;
    createTasks?: boolean;
    projectPath?: string;
}): Promise<{
    workAnalysis: any;
    createdTasks?: any[];
}>;
/**
 * Create ClickUp tasks from work analysis
 */
export declare function createTasksFromWork(workAnalysis: any, clickupConfig: any): Promise<any[]>;
/**
 * Get ClickUp service instance
 */
export declare function createClickUpService(config: any): any;
/**
 * Get Git work analyzer instance
 */
export declare function createGitWorkAnalyzer(projectPath?: string): any;
//# sourceMappingURL=index.d.ts.map