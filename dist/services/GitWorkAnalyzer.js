/**
 * Git Work Analyzer
 *
 * Analyzes git commits and file changes to automatically detect work completed
 * and create appropriate ClickUp tasks based on actual development activity.
 */
import { exec } from "child_process";
import { promisify } from "util";
import { distance as levenshteinDistance } from "fastest-levenshtein";
import { ClickUpService } from "./ClickUpService.js";
const execAsync = promisify(exec);
export class GitWorkAnalyzer {
    projectPath;
    cache;
    cacheTTL = 5 * 60 * 1000; // 5 minutes
    constructor(projectPath = process.cwd(), cacheTTL) {
        this.projectPath = projectPath;
        this.cache = new Map();
        if (cacheTTL !== undefined) {
            this.cacheTTL = cacheTTL;
        }
    }
    /**
     * Get data from cache if valid
     */
    getCached(key) {
        const entry = this.cache.get(key);
        if (!entry)
            return null;
        const age = Date.now() - entry.timestamp;
        if (age > this.cacheTTL) {
            this.cache.delete(key);
            return null;
        }
        return entry.data;
    }
    /**
     * Store data in cache
     */
    setCached(key, data) {
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
        });
    }
    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
    }
    /**
     * Analyze work for a specific date or date range
     */
    async analyzeWork(date, endDate, author) {
        try {
            // Validate inputs
            this.validateDateInputs(date, endDate);
            // Create cache key
            const cacheKey = `analysis:${date || "today"}:${endDate || ""}:${author || "all"}`;
            // Check cache
            const cached = this.getCached(cacheKey);
            if (cached) {
                return cached;
            }
            // Verify git repository exists
            await this.verifyGitRepository();
            // Get commits for the specified date range
            const commits = await this.getCommitsForDateRange(date, endDate, author);
            // Analyze the commits to detect work patterns
            const detectedWork = await this.detectWorkFromCommits(commits);
            // Calculate summary statistics (optimized with Set)
            const totalFilesChanged = new Set(commits.flatMap((c) => c.files)).size;
            const totalLinesAdded = commits.reduce((sum, c) => sum + c.insertions, 0);
            const totalLinesDeleted = commits.reduce((sum, c) => sum + c.deletions, 0);
            const summary = this.generateWorkSummary(detectedWork, commits.length);
            const result = {
                date: date || new Date().toISOString().split("T")[0],
                totalCommits: commits.length,
                totalFilesChanged,
                totalLinesAdded,
                totalLinesDeleted,
                detectedWork,
                summary,
            };
            // Store in cache
            this.setCached(cacheKey, result);
            return result;
        }
        catch (error) {
            // Provide more specific error messages
            if (error instanceof Error) {
                if (error.message.includes("not a git repository")) {
                    throw new Error(`Not a git repository: ${this.projectPath}. Please ensure you're running this from a git project.`);
                }
                else if (error.message.includes("fatal")) {
                    throw new Error(`Git error: ${error.message}. Please check your git installation and repository.`);
                }
            }
            throw new Error(`Failed to analyze work: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
    }
    /**
     * Validate date inputs
     */
    validateDateInputs(startDate, endDate) {
        if (startDate && !this.isValidDateFormat(startDate)) {
            throw new Error(`Invalid start date format: ${startDate}. Expected YYYY-MM-DD format.`);
        }
        if (endDate && !this.isValidDateFormat(endDate)) {
            throw new Error(`Invalid end date format: ${endDate}. Expected YYYY-MM-DD format.`);
        }
        if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            if (start > end) {
                throw new Error(`Start date (${startDate}) must be before or equal to end date (${endDate}).`);
            }
        }
    }
    /**
     * Check if date is in valid format (YYYY-MM-DD)
     */
    isValidDateFormat(dateString) {
        const regex = /^\d{4}-\d{2}-\d{2}$/;
        if (!regex.test(dateString))
            return false;
        const date = new Date(dateString);
        return date instanceof Date && !isNaN(date.getTime());
    }
    /**
     * Verify that the project path is a git repository
     */
    async verifyGitRepository() {
        try {
            await execAsync("git rev-parse --git-dir", { cwd: this.projectPath });
        }
        catch (error) {
            throw new Error(`Not a git repository: ${this.projectPath}. Please ensure you're in a git project.`);
        }
    }
    /**
     * Get commits for a specific date range
     */
    async getCommitsForDateRange(startDate, endDate, author) {
        try {
            // Create cache key for commits
            const cacheKey = `commits:${startDate || ""}:${endDate || ""}:${author || ""}`;
            // Check cache
            const cached = this.getCached(cacheKey);
            if (cached) {
                return cached;
            }
            // Optimize git command - add --no-merges to skip merge commits at git level
            let gitCommand = 'git log --pretty=format:"%H|%an|%ad|%s" --date=short --numstat --no-merges';
            // Add date filtering
            if (startDate) {
                gitCommand += ` --since="${startDate} 00:00:00"`;
            }
            if (endDate) {
                gitCommand += ` --until="${endDate} 23:59:59"`;
            }
            // Add author filtering
            if (author) {
                gitCommand += ` --author="${author}"`;
            }
            const { stdout } = await execAsync(gitCommand, {
                cwd: this.projectPath,
                maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large repos
            });
            const commits = this.parseGitLog(stdout);
            // Store in cache
            this.setCached(cacheKey, commits);
            return commits;
        }
        catch (error) {
            throw new Error(`Failed to get git commits: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
    }
    /**
     * Parse git log output into structured data
     */
    parseGitLog(logOutput) {
        const commits = [];
        const lines = logOutput.trim().split("\n");
        let currentCommit = null;
        // Patterns to identify merge commits
        const mergePatterns = [
            /^merge pull request #\d+/i,
            /^merge branch/i,
            /^merge remote-tracking branch/i,
            /^merge \w+ into \w+/i,
            /^merged in [a-z0-9-]+\//i,
            /^merge:/i,
        ];
        for (const line of lines) {
            if (line.includes("|")) {
                // This is a commit header
                if (currentCommit && !this.isMergeCommit(currentCommit.message || "", mergePatterns)) {
                    commits.push(currentCommit);
                }
                const [hash, author, date, message] = line.split("|");
                currentCommit = {
                    hash: hash ?? "",
                    author: author ?? "",
                    date: date ?? "",
                    message: message ?? "",
                    files: [],
                    insertions: 0,
                    deletions: 0,
                };
            }
            else if (currentCommit && line.trim() && !line.startsWith("commit")) {
                // This is a file change line
                const parts = line.split("\t");
                if (parts.length >= 2) {
                    const file = parts[2] || parts[1];
                    const insertions = parseInt(parts[0] || "0") || 0;
                    const deletions = parseInt(parts[1] || "0") || 0;
                    currentCommit.files.push(file ?? "");
                    currentCommit.insertions += insertions;
                    currentCommit.deletions += deletions;
                }
            }
        }
        if (currentCommit && !this.isMergeCommit(currentCommit.message || "", mergePatterns)) {
            commits.push(currentCommit);
        }
        return commits;
    }
    /**
     * Check if a commit message indicates a merge commit
     */
    isMergeCommit(message, patterns) {
        return patterns.some(pattern => pattern.test(message.trim()));
    }
    /**
     * Detect work patterns from commits with intelligent duplicate detection
     */
    async detectWorkFromCommits(commits) {
        const workMap = new Map();
        for (const commit of commits) {
            const workItems = this.analyzeCommit(commit);
            for (const workItem of workItems) {
                const matchingKey = this.findSimilarWorkItem(workItem, workMap);
                if (matchingKey) {
                    // Merge with existing similar work
                    const existing = workMap.get(matchingKey);
                    // Merge files (avoid duplicates)
                    const existingFileSet = new Set(existing.files);
                    for (const file of workItem.files) {
                        existingFileSet.add(file);
                    }
                    existing.files = Array.from(existingFileSet);
                    // Merge commits (avoid duplicates)
                    const existingCommitHashes = new Set(existing.commits.map(c => c.hash));
                    for (const newCommit of workItem.commits) {
                        if (!existingCommitHashes.has(newCommit.hash)) {
                            existing.commits.push(newCommit);
                        }
                    }
                    // Add estimated hours
                    existing.estimatedHours += workItem.estimatedHours;
                    // Merge tags (avoid duplicates)
                    existing.tags = [...new Set([...existing.tags, ...workItem.tags])];
                }
                else {
                    // Add as new work item
                    const key = this.normalizeWorkName(workItem.name);
                    workMap.set(key, workItem);
                }
            }
        }
        return Array.from(workMap.values());
    }
    /**
     * Find similar work item using fuzzy matching
     * Returns the key of a similar work item if found, null otherwise
     */
    findSimilarWorkItem(newWork, workMap) {
        const normalizedNewName = this.normalizeWorkName(newWork.name);
        const similarityThreshold = 0.8; // 80% similarity required
        for (const [key, existingWork] of workMap.entries()) {
            // Check if same work type
            if (existingWork.type !== newWork.type) {
                continue;
            }
            // Calculate similarity
            const similarity = this.calculateSimilarity(normalizedNewName, key);
            if (similarity >= similarityThreshold) {
                return key;
            }
        }
        return null;
    }
    /**
     * Calculate similarity between two strings (0 to 1, where 1 is identical)
     */
    calculateSimilarity(str1, str2) {
        if (str1 === str2)
            return 1;
        const maxLength = Math.max(str1.length, str2.length);
        if (maxLength === 0)
            return 1;
        const distance = levenshteinDistance(str1, str2);
        return 1 - distance / maxLength;
    }
    /**
     * Normalize work name for comparison
     */
    normalizeWorkName(name) {
        return name
            .toLowerCase()
            .trim()
            .replace(/[^\w\s]/g, '') // Remove special characters
            .replace(/\s+/g, ' '); // Normalize whitespace
    }
    /**
     * Analyze a single commit to detect work
     */
    analyzeCommit(commit) {
        const workItems = [];
        const message = commit.message.toLowerCase();
        const files = commit.files;
        // Feature detection patterns
        const featurePatterns = [
            /add\s+(.+)/i,
            /implement\s+(.+)/i,
            /create\s+(.+)/i,
            /build\s+(.+)/i,
            /develop\s+(.+)/i,
        ];
        // Bug fix patterns
        const bugFixPatterns = [
            /fix\s+(.+)/i,
            /resolve\s+(.+)/i,
            /correct\s+(.+)/i,
            /repair\s+(.+)/i,
            /bug\s+(.+)/i,
        ];
        // Improvement patterns
        const improvementPatterns = [
            /improve\s+(.+)/i,
            /enhance\s+(.+)/i,
            /optimize\s+(.+)/i,
            /refactor\s+(.+)/i,
            /update\s+(.+)/i,
        ];
        // Test patterns
        const testPatterns = [
            /test\s+(.+)/i,
            /add\s+test/i,
            /unit\s+test/i,
            /integration\s+test/i,
        ];
        // Documentation patterns
        const docPatterns = [/doc\s+(.+)/i, /document\s+(.+)/i, /readme/i, /docs/i];
        // Determine work type and name
        let workType = "improvement";
        let workName = commit.message;
        if (bugFixPatterns.some((pattern) => pattern.test(message))) {
            workType = "bug-fix";
            const match = bugFixPatterns.find((pattern) => pattern.test(message));
            if (match) {
                const result = message.match(match);
                workName = result ? result[1] ?? commit.message : commit.message;
            }
        }
        else if (featurePatterns.some((pattern) => pattern.test(message))) {
            workType = "feature";
            const match = featurePatterns.find((pattern) => pattern.test(message));
            if (match) {
                const result = message.match(match);
                workName = result ? result[1] ?? commit.message : commit.message;
            }
        }
        else if (testPatterns.some((pattern) => pattern.test(message))) {
            workType = "test";
            workName = `Test: ${commit.message}`;
        }
        else if (docPatterns.some((pattern) => pattern.test(message))) {
            workType = "documentation";
            workName = `Documentation: ${commit.message}`;
        }
        else if (improvementPatterns.some((pattern) => pattern.test(message))) {
            workType = "improvement";
            const match = improvementPatterns.find((pattern) => pattern.test(message));
            if (match) {
                const result = message.match(match);
                workName = result ? result[1] ?? commit.message : commit.message;
            }
        }
        // Determine complexity based on file changes and lines
        const complexity = this.determineComplexity(commit);
        const estimatedHours = this.estimateHours(commit, complexity);
        // Generate tags based on file types and patterns
        const tags = this.generateTags(files, message);
        workItems.push({
            type: workType,
            name: workName,
            description: this.generateDescription(commit, workType),
            files,
            commits: [commit],
            complexity,
            estimatedHours,
            tags,
        });
        return workItems;
    }
    /**
     * Determine work complexity based on commit data
     */
    determineComplexity(commit) {
        const totalChanges = commit.insertions + commit.deletions;
        const fileCount = commit.files.length;
        if (totalChanges < 50 && fileCount <= 3) {
            return "low";
        }
        else if (totalChanges < 200 && fileCount <= 10) {
            return "medium";
        }
        else {
            return "high";
        }
    }
    /**
     * Estimate hours based on commit complexity
     */
    estimateHours(commit, complexity) {
        const baseHours = {
            low: 0.5,
            medium: 2,
            high: 4,
        };
        const fileMultiplier = Math.min(commit.files.length / 5, 2); // Cap at 2x
        return baseHours[complexity] * (1 + fileMultiplier);
    }
    /**
     * Generate tags based on file types and commit message
     */
    generateTags(files, message) {
        const tags = [];
        // File type tags
        if (files.some((f) => f.includes(".tsx") || f.includes(".jsx")))
            tags.push("frontend");
        if (files.some((f) => f.includes(".ts") && !f.includes(".tsx")))
            tags.push("backend");
        if (files.some((f) => f.includes(".css") || f.includes(".scss")))
            tags.push("styling");
        if (files.some((f) => f.includes(".test.") || f.includes(".spec.")))
            tags.push("testing");
        if (files.some((f) => f.includes("api/") || f.includes("routes/")))
            tags.push("api");
        if (files.some((f) => f.includes("components/")))
            tags.push("components");
        if (files.some((f) => f.includes("utils/") || f.includes("services/")))
            tags.push("utilities");
        // Message-based tags
        if (message.includes("auth"))
            tags.push("authentication");
        if (message.includes("payment"))
            tags.push("payment");
        if (message.includes("analytics"))
            tags.push("analytics");
        if (message.includes("clickup"))
            tags.push("clickup");
        if (message.includes("admin"))
            tags.push("admin");
        if (message.includes("ui") || message.includes("ux"))
            tags.push("ui-ux");
        return [...new Set(tags)]; // Remove duplicates
    }
    /**
     * Generate description for work item
     */
    generateDescription(commit, workType) {
        const fileCount = commit.files.length;
        const totalChanges = commit.insertions + commit.deletions;
        let description = `${commit.message}\n\n`;
        description += `Files changed: ${fileCount}\n`;
        description += `Lines added: ${commit.insertions}\n`;
        description += `Lines deleted: ${commit.deletions}\n`;
        description += `Total changes: ${totalChanges}\n\n`;
        if (commit.files.length > 0) {
            description += `Key files:\n${commit.files
                .slice(0, 5)
                .map((f) => `- ${f}`)
                .join("\n")}`;
            if (commit.files.length > 5) {
                description += `\n... and ${commit.files.length - 5} more files`;
            }
        }
        return description;
    }
    /**
     * Generate work summary
     */
    generateWorkSummary(detectedWork, commitCount) {
        const workTypes = detectedWork.reduce((acc, work) => {
            acc[work.type] = (acc[work.type] || 0) + 1;
            return acc;
        }, {});
        const totalHours = detectedWork.reduce((sum, work) => sum + work.estimatedHours, 0);
        let summary = `Completed ${commitCount} commits with ${detectedWork.length} distinct work items.\n\n`;
        summary += `Work breakdown:\n`;
        Object.entries(workTypes).forEach(([type, count]) => {
            summary += `- ${type}: ${count} items\n`;
        });
        summary += `\nEstimated total time: ${totalHours.toFixed(1)} hours`;
        return summary;
    }
    /**
     * Create ClickUp tasks from detected work (with batch processing)
     */
    async createTasksFromWork(workAnalysis, config, batchSize = 5) {
        try {
            const clickUpService = new ClickUpService(config);
            const createdTasks = [];
            // Create summary task
            const summaryTask = await clickUpService.createTask({
                name: `📊 Daily Work Summary - ${workAnalysis.date}`,
                description: workAnalysis.summary,
                priority: "normal",
                tags: ["daily-summary", "automated", workAnalysis.date],
                subtasks: workAnalysis.detectedWork.map((work) => ({
                    name: `${work.type === "feature"
                        ? "✅"
                        : work.type === "bug-fix"
                            ? "🐛"
                            : "🔧"} ${work.name}`,
                    description: work.description,
                    priority: work.complexity === "high"
                        ? "high"
                        : work.complexity === "medium"
                            ? "normal"
                            : "low",
                })),
            });
            createdTasks.push(summaryTask);
            // Batch process individual tasks for better performance
            const workItems = workAnalysis.detectedWork;
            for (let i = 0; i < workItems.length; i += batchSize) {
                const batch = workItems.slice(i, i + batchSize);
                // Process batch in parallel
                const batchPromises = batch.map((work) => clickUpService.createTask({
                    name: `${work.type === "feature"
                        ? "✅"
                        : work.type === "bug-fix"
                            ? "🐛"
                            : "🔧"} ${work.name}`,
                    description: work.description,
                    priority: work.complexity === "high"
                        ? "high"
                        : work.complexity === "medium"
                            ? "normal"
                            : "low",
                    status: "complete",
                    tags: [work.type, "completed", workAnalysis.date, ...work.tags],
                    timeEstimate: work.estimatedHours * 60 * 60 * 1000, // Convert to milliseconds
                }).catch((error) => {
                    console.error(`Failed to create task for ${work.name}:`, error);
                    return null; // Return null for failed tasks
                }));
                // Wait for batch to complete
                const batchResults = await Promise.all(batchPromises);
                // Add successful tasks
                createdTasks.push(...batchResults.filter((task) => task !== null));
                // Small delay between batches to avoid rate limiting
                if (i + batchSize < workItems.length) {
                    await new Promise((resolve) => setTimeout(resolve, 100));
                }
            }
            return createdTasks;
        }
        catch (error) {
            throw new Error(`Failed to create tasks: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
    }
}
//# sourceMappingURL=GitWorkAnalyzer.js.map