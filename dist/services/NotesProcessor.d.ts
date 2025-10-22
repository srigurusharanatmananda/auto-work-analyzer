/**
 * Notes Processor
 *
 * Processes notes from various sources (text files, uploaded notes, etc.)
 * and converts them into structured, meaningful tasks with descriptions.
 */
import { DetectedWork } from "../types/index.js";
export interface ProcessedNote {
    originalText: string;
    tasks: DetectedWork[];
}
export interface NoteTask {
    text: string;
    lineNumber: number;
}
export declare class NotesProcessor {
    private taskPatterns;
    private featureKeywords;
    private bugKeywords;
    private improvementKeywords;
    private testKeywords;
    private docKeywords;
    /**
     * Process notes and extract tasks
     */
    processNotes(notesText: string): Promise<ProcessedNote>;
    /**
     * Extract tasks from structured notes (bullets, numbers, etc.)
     */
    private extractTasks;
    /**
     * Extract tasks from free-form text (paragraphs, sentences)
     */
    private extractFromFreeForm;
    /**
     * Check if text is likely a task (contains action verbs)
     */
    private isLikelyTask;
    /**
     * Convert extracted task text into DetectedWork object
     */
    private convertToDetectedWork;
    /**
     * Clean task text by removing markers and extra whitespace
     */
    private cleanTaskText;
    /**
     * Format task name to be clear and concise
     */
    private formatTaskName;
    /**
     * Generate meaningful description from task text
     */
    private generateDescription;
    /**
     * Estimate complexity based on task text
     */
    private estimateComplexity;
    /**
     * Estimate hours based on complexity
     */
    private estimateHours;
    /**
     * Generate tags based on task content
     */
    private generateTags;
    /**
     * Format work type for display
     */
    private formatWorkType;
    /**
     * Check if text contains any of the keywords
     */
    private containsAnyKeyword;
}
//# sourceMappingURL=NotesProcessor.d.ts.map