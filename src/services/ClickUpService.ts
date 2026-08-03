/**
 * ClickUp Service
 *
 * Generic service for managing ClickUp tasks across multiple projects.
 */

import {
  ClickUpConfig,
  TaskData,
  ClickUpTask,
  ProjectTemplate,
} from "../types/index.js";

export class ClickUpService {
  private config: ClickUpConfig;
  private baseUrl = "https://api.clickup.com/api/v2";
  private maxRetries = 3;
  private retryDelay = 1000; // 1 second

  constructor(config: ClickUpConfig, maxRetries?: number) {
    this.config = config;
    if (maxRetries !== undefined) {
      this.maxRetries = maxRetries;
    }
  }

  /**
   * Get user ID from email address
   */
  private async getUserIdFromEmail(email: string): Promise<string | null> {
    try {
      const teamInfo = await this.getTeamInfo();
      const member = teamInfo.team.members.find(
        (m: any) => m.user.email?.toLowerCase() === email.toLowerCase()
      );
      return member ? member.user.id.toString() : null;
    } catch (error) {
      console.warn(`Failed to get user ID for email ${email}:`, error);
      return null;
    }
  }

  /**
   * Get default assignee ID if configured
   */
  private async getDefaultAssigneeId(): Promise<string[]> {
    if (!this.config.defaultAssignee) {
      return [];
    }

    const userId = await this.getUserIdFromEmail(this.config.defaultAssignee);
    return userId ? [userId] : [];
  }

  /**
   * Retry wrapper for API calls with exponential backoff
   */
  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    retries: number = this.maxRetries
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (retries <= 0) {
        throw error;
      }

      // Check if error is retryable (rate limit, server error, network error)
      const isRetryable =
        error instanceof Error &&
        (error.message.includes("429") || // Rate limit
          error.message.includes("500") || // Server error
          error.message.includes("502") || // Bad gateway
          error.message.includes("503") || // Service unavailable
          error.message.includes("504") || // Gateway timeout
          error.message.includes("ECONNRESET") || // Connection reset
          error.message.includes("ETIMEDOUT")); // Timeout

      if (!isRetryable) {
        throw error;
      }

      // Calculate delay with exponential backoff
      const delay = this.retryDelay * Math.pow(2, this.maxRetries - retries);

      console.log(
        `API call failed, retrying in ${delay}ms... (${retries} retries left)`
      );

      await new Promise((resolve) => setTimeout(resolve, delay));

      return this.retryWithBackoff(fn, retries - 1);
    }
  }

  /**
   * Create a new task in ClickUp (with retry logic)
   */
  async createTask(taskData: TaskData, listId?: string): Promise<ClickUpTask> {
    return this.retryWithBackoff(async () => {
      const targetListId = listId || this.config.defaultListId;
      if (!targetListId) {
        throw new Error("No list ID provided and no default list configured");
      }

      // Validate task data
      if (!taskData.name || taskData.name.trim().length === 0) {
        throw new Error("Task name is required");
      }

      if (taskData.name.length > 500) {
        throw new Error("Task name too long (max 500 characters)");
      }

      // Get assignees - use provided assignees or default assignee
      let assignees = taskData.assignees || [];
      if (assignees.length === 0) {
        assignees = await this.getDefaultAssigneeId();
      }

      const payload: Record<string, any> = {
        name: taskData.name.trim(),
        description: taskData.description || "",
        markdown_description: taskData.description || "", // ClickUp supports markdown formatting
        priority: this.mapPriority(taskData.priority),
        assignees: assignees,
        tags: taskData.tags || [],
        due_date: taskData.dueDate
          ? new Date(taskData.dueDate).getTime()
          : null,
        time_estimate: taskData.timeEstimate || null,
        custom_fields: taskData.customFields || ([] as any[]),
      };

      // Only include status if explicitly provided — ClickUp will use the list's default otherwise
      if (taskData.status) {
        payload.status = taskData.status;
      }

      const response = await fetch(
        `${this.baseUrl}/list/${targetListId}/task`,
        {
          method: "POST",
          headers: {
            Authorization: this.config.apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to create task: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      const result = await response.json();

      // Create subtasks if provided
      if (taskData.subtasks && taskData.subtasks.length > 0) {
        try {
          const subtasks = await Promise.all(
            taskData.subtasks.map((subtask) =>
              this.createSubtask(result.id, subtask, targetListId)
            )
          );
          result.subtasks = subtasks;
        } catch (error) {
          console.error(`Failed to create subtasks for task ${result.id}:`, error);
          // Don't fail the entire task creation if subtasks fail
        }
      }

      return result;
    });
  }

  /**
   * Create a subtask
   */
  async createSubtask(
    parentTaskId: string,
    subtaskData: Omit<TaskData, "subtasks">,
    listId?: string
  ): Promise<ClickUpTask> {
    const targetListId = listId || this.config.defaultListId;
    if (!targetListId) {
      throw new Error("No list ID provided and no default list configured");
    }

    const payload: Record<string, any> = {
      name: subtaskData.name,
      description: subtaskData.description || "",
      markdown_description: subtaskData.description || "", // ClickUp supports markdown formatting
      priority: this.mapPriority(subtaskData.priority),
      assignees: subtaskData.assignees || [],
      tags: subtaskData.tags || [],
      due_date: subtaskData.dueDate
        ? new Date(subtaskData.dueDate).getTime()
        : null,
      time_estimate: subtaskData.timeEstimate || null,
      custom_fields: subtaskData.customFields || ([] as any[]),
    };

    // Only include status if explicitly provided — ClickUp will use the list's default otherwise
    if (subtaskData.status) {
      payload.status = subtaskData.status;
    }

    const response = await fetch(
      `${this.baseUrl}/list/${targetListId}/task`,
      {
        method: "POST",
        headers: {
          Authorization: this.config.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...payload,
          parent: parentTaskId,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to create subtask: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    return await response.json();
  }

  /**
   * Get tasks from a list
   */
  async getTasks(
    listId?: string,
    includeClosed = false
  ): Promise<ClickUpTask[]> {
    const targetListId = listId || this.config.defaultListId;
    if (!targetListId) {
      throw new Error("No list ID provided and no default list configured");
    }

    const response = await fetch(
      `${this.baseUrl}/list/${targetListId}/task?archived=false&include_closed=${includeClosed}`,
      {
        method: "GET",
        headers: {
          Authorization: this.config.apiKey,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to fetch tasks: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const result = await response.json();
    return result.tasks || [];
  }

  /**
   * Get task by ID
   */
  async getTask(taskId: string): Promise<ClickUpTask> {
    const response = await fetch(`${this.baseUrl}/task/${taskId}`, {
      method: "GET",
      headers: {
        Authorization: this.config.apiKey,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to fetch task: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    return await response.json();
  }

  /**
   * Update task status
   */
  async updateTaskStatus(taskId: string, status: string): Promise<ClickUpTask> {
    const response = await fetch(`${this.baseUrl}/task/${taskId}`, {
      method: "PUT",
      headers: {
        Authorization: this.config.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to update task: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    return await response.json();
  }

  /**
   * Create tasks from a project template
   */
  async createTasksFromTemplate(
    template: ProjectTemplate,
    listId?: string
  ): Promise<ClickUpTask[]> {
    const tasks = await Promise.all(
      template.tasks.map((taskData) => this.createTask(taskData, listId))
    );
    return tasks;
  }

  /**
   * Get team information
   */
  async getTeamInfo(): Promise<any> {
    const response = await fetch(`${this.baseUrl}/team/${this.config.teamId}`, {
      method: "GET",
      headers: {
        Authorization: this.config.apiKey,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to fetch team info: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    return await response.json();
  }

  /**
   * Get spaces in the team
   */
  async getSpaces(): Promise<any[]> {
    const response = await fetch(
      `${this.baseUrl}/team/${this.config.teamId}/space`,
      {
        method: "GET",
        headers: {
          Authorization: this.config.apiKey,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to fetch spaces: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const result = await response.json();
    return result.spaces || [];
  }

  /**
   * Get lists in a space
   */
  async getLists(spaceId: string): Promise<any[]> {
    const response = await fetch(`${this.baseUrl}/space/${spaceId}/list`, {
      method: "GET",
      headers: {
        Authorization: this.config.apiKey,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to fetch lists: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const result = await response.json();
    return result.lists || [];
  }

  /**
   * Every workspace this API key can see.
   *
   * Unlike `getTeamInfo`, this needs no configured `teamId` — it is what the
   * destination picker calls first, when the user has pasted a key and nothing
   * else is known yet.
   */
  async getTeams(): Promise<Array<{ id: string; name: string }>> {
    const result = await this.getJson(`/team`, "teams");
    return (result as any[]).map((team) => ({ id: team.id, name: team.name }));
  }

  /**
   * Folders within a space.
   */
  async getFolders(spaceId: string): Promise<Array<{ id: string; name: string }>> {
    const result = await this.getJson(`/space/${spaceId}/folder`, "folders");
    return (result as any[]).map((folder) => ({ id: folder.id, name: folder.name }));
  }

  /**
   * Lists inside a folder.
   */
  async getListsInFolder(folderId: string): Promise<Array<{ id: string; name: string }>> {
    const result = await this.getJson(`/folder/${folderId}/list`, "lists");
    return (result as any[]).map((list) => ({ id: list.id, name: list.name }));
  }

  /**
   * Lists that sit directly under a space with no folder. ClickUp allows these
   * and a folder-only picker would hide them.
   */
  async getFolderlessLists(spaceId: string): Promise<Array<{ id: string; name: string }>> {
    const result = await this.getJson(`/space/${spaceId}/list`, "lists");
    return (result as any[]).map((list) => ({ id: list.id, name: list.name }));
  }

  /**
   * The status names configured on a list, in board order.
   *
   * This is what makes the status mapping possible: statuses are per-list in
   * ClickUp, so the only way to know whether "complete" exists is to ask.
   */
  async getListStatuses(listId: string): Promise<string[]> {
    const response = await fetch(`${this.baseUrl}/list/${listId}`, {
      method: "GET",
      headers: {
        Authorization: this.config.apiKey,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to fetch list: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const list = await response.json();
    const statuses = (list.statuses || []) as Array<{ status: string; orderindex?: number }>;
    return statuses
      .slice()
      .sort((a, b) => (a.orderindex ?? 0) - (b.orderindex ?? 0))
      .map((entry) => entry.status);
  }

  /** Shared GET helper for collection endpoints. */
  private async getJson(path: string, collectionKey: string): Promise<unknown[]> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "GET",
      headers: {
        Authorization: this.config.apiKey,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to fetch ${collectionKey}: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const result = await response.json();
    return result[collectionKey] || [];
  }

  /**
   * Map priority string to ClickUp priority number
   */
  private mapPriority(priority?: string): number {
    switch (priority) {
      case "urgent":
        return 1;
      case "high":
        return 2;
      case "normal":
        return 3;
      case "low":
        return 4;
      default:
        return 3;
    }
  }

  /**
   * Create a development workflow template
   */
  static createDevelopmentTemplate(
    featureName: string,
    description: string
  ): ProjectTemplate {
    return {
      name: `Development: ${featureName}`,
      description,
      tasks: [
        {
          name: `Research & Planning: ${featureName}`,
          description: `Research requirements and create technical plan for ${featureName}`,
          priority: "high",
          tags: ["research", "planning"],
          subtasks: [
            {
              name: "Requirements Analysis",
              description: "Analyze user requirements and business needs",
              priority: "high",
            },
            {
              name: "Technical Design",
              description: "Create technical architecture and design documents",
              priority: "high",
            },
            {
              name: "API Design",
              description: "Design API endpoints and data structures",
              priority: "normal",
            },
          ],
        },
        {
          name: `Implementation: ${featureName}`,
          description: `Implement the core functionality for ${featureName}`,
          priority: "high",
          tags: ["development", "implementation"],
          subtasks: [
            {
              name: "Backend Implementation",
              description: "Implement server-side logic and APIs",
              priority: "high",
            },
            {
              name: "Frontend Implementation",
              description: "Implement user interface and client-side logic",
              priority: "high",
            },
            {
              name: "Database Schema",
              description: "Create and update database schema as needed",
              priority: "normal",
            },
            {
              name: "Integration",
              description: "Integrate frontend and backend components",
              priority: "normal",
            },
          ],
        },
        {
          name: `Testing: ${featureName}`,
          description: `Test the implementation of ${featureName}`,
          priority: "normal",
          tags: ["testing", "qa"],
          subtasks: [
            {
              name: "Unit Tests",
              description: "Write and run unit tests for new functionality",
              priority: "normal",
            },
            {
              name: "Integration Tests",
              description: "Test integration between components",
              priority: "normal",
            },
            {
              name: "User Acceptance Testing",
              description:
                "Test from user perspective and validate requirements",
              priority: "normal",
            },
          ],
        },
        {
          name: `Documentation: ${featureName}`,
          description: `Create documentation for ${featureName}`,
          priority: "low",
          tags: ["documentation"],
          subtasks: [
            {
              name: "API Documentation",
              description: "Document API endpoints and usage",
              priority: "low",
            },
            {
              name: "User Documentation",
              description: "Create user guides and help content",
              priority: "low",
            },
            {
              name: "Technical Documentation",
              description: "Document technical implementation details",
              priority: "low",
            },
          ],
        },
        {
          name: `Deployment: ${featureName}`,
          description: `Deploy ${featureName} to production`,
          priority: "high",
          tags: ["deployment", "production"],
          subtasks: [
            {
              name: "Pre-deployment Checklist",
              description: "Verify all requirements are met before deployment",
              priority: "high",
            },
            {
              name: "Deploy to Staging",
              description: "Deploy to staging environment for final testing",
              priority: "high",
            },
            {
              name: "Deploy to Production",
              description: "Deploy to production environment",
              priority: "high",
            },
            {
              name: "Post-deployment Verification",
              description: "Verify deployment success and monitor for issues",
              priority: "normal",
            },
          ],
        },
      ],
    };
  }

  /**
   * Create a bug fix template
   */
  static createBugFixTemplate(
    bugDescription: string,
    severity: "critical" | "high" | "medium" | "low"
  ): ProjectTemplate {
    const priority =
      severity === "critical"
        ? "urgent"
        : severity === "high"
        ? "high"
        : "normal";

    return {
      name: `Bug Fix: ${bugDescription}`,
      description: `Fix bug: ${bugDescription}`,
      tasks: [
        {
          name: `Investigation: ${bugDescription}`,
          description: `Investigate and reproduce the bug: ${bugDescription}`,
          priority: priority,
          tags: ["bug", "investigation", severity],
          subtasks: [
            {
              name: "Reproduce Bug",
              description: "Reproduce the bug in a controlled environment",
              priority: priority,
            },
            {
              name: "Identify Root Cause",
              description: "Identify the root cause of the bug",
              priority: priority,
            },
            {
              name: "Impact Assessment",
              description: "Assess the impact and scope of the bug",
              priority: priority,
            },
          ],
        },
        {
          name: `Fix Implementation: ${bugDescription}`,
          description: `Implement fix for: ${bugDescription}`,
          priority: priority,
          tags: ["bug", "fix", "implementation"],
          subtasks: [
            {
              name: "Code Fix",
              description: "Implement the actual code fix",
              priority: priority,
            },
            {
              name: "Test Fix",
              description: "Test the fix to ensure it resolves the issue",
              priority: priority,
            },
            {
              name: "Regression Testing",
              description: "Ensure fix does not introduce new issues",
              priority: priority,
            },
          ],
        },
        {
          name: `Deploy Fix: ${bugDescription}`,
          description: `Deploy the fix for: ${bugDescription}`,
          priority: priority,
          tags: ["bug", "deployment"],
          subtasks: [
            {
              name: "Deploy to Staging",
              description: "Deploy fix to staging for testing",
              priority: priority,
            },
            {
              name: "Deploy to Production",
              description: "Deploy fix to production",
              priority: priority,
            },
            {
              name: "Monitor Fix",
              description: "Monitor the fix in production",
              priority: priority,
            },
          ],
        },
      ],
    };
  }

  /**
   * Create an improvement template
   */
  static createImprovementTemplate(
    improvementName: string,
    description: string
  ): ProjectTemplate {
    return {
      name: `Improvement: ${improvementName}`,
      description,
      tasks: [
        {
          name: `Analysis: ${improvementName}`,
          description: `Analyze current state and improvement opportunities for ${improvementName}`,
          priority: "normal",
          tags: ["improvement", "analysis"],
          subtasks: [
            {
              name: "Current State Analysis",
              description:
                "Analyze current implementation and identify pain points",
              priority: "normal",
            },
            {
              name: "Improvement Opportunities",
              description: "Identify specific improvement opportunities",
              priority: "normal",
            },
            {
              name: "Impact Assessment",
              description: "Assess potential impact of improvements",
              priority: "normal",
            },
          ],
        },
        {
          name: `Design: ${improvementName}`,
          description: `Design the improved solution for ${improvementName}`,
          priority: "normal",
          tags: ["improvement", "design"],
          subtasks: [
            {
              name: "Solution Design",
              description: "Design the improved solution",
              priority: "normal",
            },
            {
              name: "Implementation Plan",
              description: "Create detailed implementation plan",
              priority: "normal",
            },
            {
              name: "Migration Strategy",
              description: "Plan migration from current to improved solution",
              priority: "normal",
            },
          ],
        },
        {
          name: `Implementation: ${improvementName}`,
          description: `Implement improvements for ${improvementName}`,
          priority: "normal",
          tags: ["improvement", "implementation"],
          subtasks: [
            {
              name: "Backend Improvements",
              description: "Implement backend improvements",
              priority: "normal",
            },
            {
              name: "Frontend Improvements",
              description: "Implement frontend improvements",
              priority: "normal",
            },
            {
              name: "Performance Optimization",
              description: "Optimize performance based on improvements",
              priority: "normal",
            },
          ],
        },
        {
          name: `Testing & Validation: ${improvementName}`,
          description: `Test and validate improvements for ${improvementName}`,
          priority: "normal",
          tags: ["improvement", "testing"],
          subtasks: [
            {
              name: "Functionality Testing",
              description: "Test improved functionality",
              priority: "normal",
            },
            {
              name: "Performance Testing",
              description: "Test performance improvements",
              priority: "normal",
            },
            {
              name: "User Acceptance Testing",
              description: "Validate improvements with users",
              priority: "normal",
            },
          ],
        },
      ],
    };
  }
}
