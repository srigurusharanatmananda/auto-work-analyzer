/**
 * ClickUp Service
 *
 * Generic service for managing ClickUp tasks across multiple projects.
 */
import { ClickUpConfig, TaskData, ClickUpTask, ProjectTemplate } from "../types/index.js";
export declare class ClickUpService {
    private config;
    private baseUrl;
    private maxRetries;
    private retryDelay;
    constructor(config: ClickUpConfig, maxRetries?: number);
    /**
     * Get user ID from email address
     */
    private getUserIdFromEmail;
    /**
     * Get default assignee ID if configured
     */
    private getDefaultAssigneeId;
    /**
     * Retry wrapper for API calls with exponential backoff
     */
    private retryWithBackoff;
    /**
     * Create a new task in ClickUp (with retry logic)
     */
    createTask(taskData: TaskData, listId?: string): Promise<ClickUpTask>;
    /**
     * Create a subtask
     */
    createSubtask(parentTaskId: string, subtaskData: Omit<TaskData, "subtasks">): Promise<ClickUpTask>;
    /**
     * Get tasks from a list
     */
    getTasks(listId?: string, includeClosed?: boolean): Promise<ClickUpTask[]>;
    /**
     * Get task by ID
     */
    getTask(taskId: string): Promise<ClickUpTask>;
    /**
     * Update task status
     */
    updateTaskStatus(taskId: string, status: string): Promise<ClickUpTask>;
    /**
     * Create tasks from a project template
     */
    createTasksFromTemplate(template: ProjectTemplate, listId?: string): Promise<ClickUpTask[]>;
    /**
     * Get team information
     */
    getTeamInfo(): Promise<any>;
    /**
     * Get spaces in the team
     */
    getSpaces(): Promise<any[]>;
    /**
     * Get lists in a space
     */
    getLists(spaceId: string): Promise<any[]>;
    /**
     * Map priority string to ClickUp priority number
     */
    private mapPriority;
    /**
     * Create a development workflow template
     */
    static createDevelopmentTemplate(featureName: string, description: string): ProjectTemplate;
    /**
     * Create a bug fix template
     */
    static createBugFixTemplate(bugDescription: string, severity: "critical" | "high" | "medium" | "low"): ProjectTemplate;
    /**
     * Create an improvement template
     */
    static createImprovementTemplate(improvementName: string, description: string): ProjectTemplate;
}
//# sourceMappingURL=ClickUpService.d.ts.map