/**
 * Configuration management for Auto Work Analyzer
 */
import { ClickUpConfig } from "../types/index.js";
export interface AppConfig {
    clickup: ClickUpConfig;
    project: {
        name: string;
        description: string;
        path: string;
    };
    webhook: {
        secret?: string;
        port: number;
    };
    analysis: {
        daysBack: number;
        complexityThreshold: number;
        timeEstimateMultiplier: number;
    };
    logging: {
        level: string;
        file?: string;
    };
}
/**
 * Get ClickUp configuration from environment variables
 */
export declare function getClickUpConfig(): ClickUpConfig;
/**
 * Get application configuration
 */
export declare function getAppConfig(): AppConfig;
/**
 * Validate configuration
 */
export declare function validateConfig(config: AppConfig): {
    isValid: boolean;
    errors: string[];
};
/**
 * Generate setup instructions
 */
export declare function generateSetupInstructions(): string;
//# sourceMappingURL=index.d.ts.map