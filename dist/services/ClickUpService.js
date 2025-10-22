/**
 * ClickUp Service
 *
 * Generic service for managing ClickUp tasks across multiple projects.
 */
export class ClickUpService {
    config;
    baseUrl = "https://api.clickup.com/api/v2";
    maxRetries = 3;
    retryDelay = 1000; // 1 second
    constructor(config, maxRetries) {
        this.config = config;
        if (maxRetries !== undefined) {
            this.maxRetries = maxRetries;
        }
    }
    /**
     * Get user ID from email address
     */
    async getUserIdFromEmail(email) {
        try {
            const teamInfo = await this.getTeamInfo();
            const member = teamInfo.team.members.find((m) => m.user.email?.toLowerCase() === email.toLowerCase());
            return member ? member.user.id.toString() : null;
        }
        catch (error) {
            console.warn(`Failed to get user ID for email ${email}:`, error);
            return null;
        }
    }
    /**
     * Get default assignee ID if configured
     */
    async getDefaultAssigneeId() {
        if (!this.config.defaultAssignee) {
            return [];
        }
        const userId = await this.getUserIdFromEmail(this.config.defaultAssignee);
        return userId ? [userId] : [];
    }
    /**
     * Retry wrapper for API calls with exponential backoff
     */
    async retryWithBackoff(fn, retries = this.maxRetries) {
        try {
            return await fn();
        }
        catch (error) {
            if (retries <= 0) {
                throw error;
            }
            // Check if error is retryable (rate limit, server error, network error)
            const isRetryable = error instanceof Error &&
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
            console.log(`API call failed, retrying in ${delay}ms... (${retries} retries left)`);
            await new Promise((resolve) => setTimeout(resolve, delay));
            return this.retryWithBackoff(fn, retries - 1);
        }
    }
    /**
     * Create a new task in ClickUp (with retry logic)
     */
    async createTask(taskData, listId) {
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
            const payload = {
                name: taskData.name.trim(),
                description: taskData.description || "",
                priority: this.mapPriority(taskData.priority),
                status: taskData.status || "to do",
                assignees: assignees,
                tags: taskData.tags || [],
                due_date: taskData.dueDate
                    ? new Date(taskData.dueDate).getTime()
                    : null,
                time_estimate: taskData.timeEstimate || null,
                custom_fields: taskData.customFields || [],
            };
            const response = await fetch(`${this.baseUrl}/list/${targetListId}/task`, {
                method: "POST",
                headers: {
                    Authorization: this.config.apiKey,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to create task: ${response.status} ${response.statusText} - ${errorText}`);
            }
            const result = await response.json();
            // Note: Subtasks creation is temporarily disabled due to API endpoint issues
            // TODO: Re-enable subtasks once the correct ClickUp API endpoint is identified
            // if (taskData.subtasks && taskData.subtasks.length > 0) {
            //   const subtasks = await Promise.all(
            //     taskData.subtasks.map((subtask) =>
            //       this.createSubtask(result.id, subtask)
            //     )
            //   );
            //   result.subtasks = subtasks;
            // }
            return result;
        });
    }
    /**
     * Create a subtask
     */
    async createSubtask(parentTaskId, subtaskData) {
        const payload = {
            name: subtaskData.name,
            description: subtaskData.description || "",
            priority: this.mapPriority(subtaskData.priority),
            status: subtaskData.status || "to do",
            assignees: subtaskData.assignees || [],
            tags: subtaskData.tags || [],
            due_date: subtaskData.dueDate
                ? new Date(subtaskData.dueDate).getTime()
                : null,
            time_estimate: subtaskData.timeEstimate || null,
            custom_fields: subtaskData.customFields || [],
        };
        const response = await fetch(`${this.baseUrl}/list/${this.config.defaultListId}/task`, {
            method: "POST",
            headers: {
                Authorization: this.config.apiKey,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                ...payload,
                parent: parentTaskId,
            }),
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to create subtask: ${response.status} ${response.statusText} - ${errorText}`);
        }
        return await response.json();
    }
    /**
     * Get tasks from a list
     */
    async getTasks(listId, includeClosed = false) {
        const targetListId = listId || this.config.defaultListId;
        if (!targetListId) {
            throw new Error("No list ID provided and no default list configured");
        }
        const response = await fetch(`${this.baseUrl}/list/${targetListId}/task?archived=false&include_closed=${includeClosed}`, {
            method: "GET",
            headers: {
                Authorization: this.config.apiKey,
                "Content-Type": "application/json",
            },
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to fetch tasks: ${response.status} ${response.statusText} - ${errorText}`);
        }
        const result = await response.json();
        return result.tasks || [];
    }
    /**
     * Get task by ID
     */
    async getTask(taskId) {
        const response = await fetch(`${this.baseUrl}/task/${taskId}`, {
            method: "GET",
            headers: {
                Authorization: this.config.apiKey,
                "Content-Type": "application/json",
            },
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to fetch task: ${response.status} ${response.statusText} - ${errorText}`);
        }
        return await response.json();
    }
    /**
     * Update task status
     */
    async updateTaskStatus(taskId, status) {
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
            throw new Error(`Failed to update task: ${response.status} ${response.statusText} - ${errorText}`);
        }
        return await response.json();
    }
    /**
     * Create tasks from a project template
     */
    async createTasksFromTemplate(template, listId) {
        const tasks = await Promise.all(template.tasks.map((taskData) => this.createTask(taskData, listId)));
        return tasks;
    }
    /**
     * Get team information
     */
    async getTeamInfo() {
        const response = await fetch(`${this.baseUrl}/team/${this.config.teamId}`, {
            method: "GET",
            headers: {
                Authorization: this.config.apiKey,
                "Content-Type": "application/json",
            },
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to fetch team info: ${response.status} ${response.statusText} - ${errorText}`);
        }
        return await response.json();
    }
    /**
     * Get spaces in the team
     */
    async getSpaces() {
        const response = await fetch(`${this.baseUrl}/team/${this.config.teamId}/space`, {
            method: "GET",
            headers: {
                Authorization: this.config.apiKey,
                "Content-Type": "application/json",
            },
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to fetch spaces: ${response.status} ${response.statusText} - ${errorText}`);
        }
        const result = await response.json();
        return result.spaces || [];
    }
    /**
     * Get lists in a space
     */
    async getLists(spaceId) {
        const response = await fetch(`${this.baseUrl}/space/${spaceId}/list`, {
            method: "GET",
            headers: {
                Authorization: this.config.apiKey,
                "Content-Type": "application/json",
            },
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to fetch lists: ${response.status} ${response.statusText} - ${errorText}`);
        }
        const result = await response.json();
        return result.lists || [];
    }
    /**
     * Map priority string to ClickUp priority number
     */
    mapPriority(priority) {
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
    static createDevelopmentTemplate(featureName, description) {
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
                            description: "Test from user perspective and validate requirements",
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
    static createBugFixTemplate(bugDescription, severity) {
        const priority = severity === "critical"
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
    static createImprovementTemplate(improvementName, description) {
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
                            description: "Analyze current implementation and identify pain points",
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
//# sourceMappingURL=ClickUpService.js.map