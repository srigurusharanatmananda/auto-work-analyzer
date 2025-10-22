/**
 * Git Work Analyzer
 *
 * Analyzes git commits and file changes to automatically detect work completed
 * and create appropriate ClickUp tasks based on actual development activity.
 */
import { WorkAnalysisResult, ClickUpConfig } from "../types/index.js";
export declare class GitWorkAnalyzer {
    private projectPath;
    private cache;
    private cacheTTL;
    constructor(projectPath?: string, cacheTTL?: number);
    /**
     * Get data from cache if valid
     */
    private getCached;
    /**
     * Store data in cache
     */
    private setCached;
    /**
     * Clear cache
     */
    clearCache(): void;
    /**
     * Analyze work for a specific date or date range
     */
    analyzeWork(date?: string, endDate?: string, author?: string): Promise<WorkAnalysisResult>;
    /**
     * Validate date inputs
     */
    private validateDateInputs;
    /**
     * Check if date is in valid format (YYYY-MM-DD)
     */
    private isValidDateFormat;
    /**
     * Verify that the project path is a git repository
     */
    private verifyGitRepository;
    /**
     * Get commits for a specific date range
     */
    private getCommitsForDateRange;
    /**
     * Parse git log output into structured data
     */
    private parseGitLog;
    /**
     * Check if a commit message indicates a merge commit
     */
    private isMergeCommit;
    /**
     * Detect work patterns from commits with intelligent duplicate detection
     */
    private detectWorkFromCommits;
    /**
     * Find similar work item using fuzzy matching
     * Returns the key of a similar work item if found, null otherwise
     */
    private findSimilarWorkItem;
    /**
     * Calculate similarity between two strings (0 to 1, where 1 is identical)
     */
    private calculateSimilarity;
    /**
     * Normalize work name for comparison
     */
    private normalizeWorkName;
    /**
     * Analyze a single commit to detect work
     */
    private analyzeCommit;
    /**
     * Determine work complexity based on commit data
     */
    private determineComplexity;
    /**
     * Estimate hours based on commit complexity
     */
    private estimateHours;
    /**
     * Generate tags based on file types and commit message
     */
    private generateTags;
    /**
     * Generate description for work item
     */
    private generateDescription;
    /**
     * Generate work summary
     */
    private generateWorkSummary;
    /**
     * Create ClickUp tasks from detected work (with batch processing)
     */
    createTasksFromWork(workAnalysis: WorkAnalysisResult, config: ClickUpConfig, batchSize?: number): Promise<any[]>;
}
//# sourceMappingURL=GitWorkAnalyzer.d.ts.map