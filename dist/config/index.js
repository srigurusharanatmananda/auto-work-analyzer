/**
 * Configuration management for Auto Work Analyzer
 */
import { config } from "dotenv";
// Load environment variables
config();
/**
 * Get ClickUp configuration from environment variables
 */
export function getClickUpConfig() {
    const teamId = process.env.CLICKUP_TEAM_ID;
    const apiKey = process.env.CLICKUP_API_KEY;
    const defaultListId = process.env.CLICKUP_DEFAULT_LIST_ID;
    const defaultAssignee = process.env.CLICKUP_DEFAULT_ASSIGNEE || "zacchaeus.napuo@uskfoundation.or.ke";
    const projectName = process.env.PROJECT_NAME || "Auto Work Analyzer";
    const description = process.env.PROJECT_DESCRIPTION ||
        "Automatic work analysis and task creation";
    if (!teamId || !apiKey) {
        throw new Error("ClickUp credentials not configured. Please set CLICKUP_TEAM_ID and CLICKUP_API_KEY");
    }
    return {
        teamId,
        apiKey,
        defaultListId: defaultListId || undefined,
        defaultAssignee: defaultAssignee || undefined,
        projectName,
        description,
        tags: ["automated", "work-analysis"],
    };
}
/**
 * Get application configuration
 */
export function getAppConfig() {
    const clickupConfig = getClickUpConfig();
    return {
        clickup: clickupConfig,
        project: {
            name: process.env.PROJECT_NAME || "Auto Work Analyzer",
            description: process.env.PROJECT_DESCRIPTION ||
                "Automatic work analysis and task creation",
            path: process.env.PROJECT_PATH || process.cwd(),
        },
        webhook: {
            secret: process.env.WEBHOOK_SECRET || undefined,
            port: parseInt(process.env.WEBHOOK_PORT || "3000"),
        },
        analysis: {
            daysBack: parseInt(process.env.ANALYSIS_DAYS_BACK || "1"),
            complexityThreshold: parseInt(process.env.COMPLEXITY_THRESHOLD || "50"),
            timeEstimateMultiplier: parseFloat(process.env.TIME_ESTIMATE_MULTIPLIER || "1.0"),
        },
        logging: {
            level: process.env.LOG_LEVEL || "info",
            file: process.env.LOG_FILE || undefined,
        },
    };
}
/**
 * Validate configuration
 */
export function validateConfig(config) {
    const errors = [];
    // Validate ClickUp configuration
    if (!config.clickup.teamId) {
        errors.push("CLICKUP_TEAM_ID is required");
    }
    if (!config.clickup.apiKey) {
        errors.push("CLICKUP_API_KEY is required");
    }
    if (!config.clickup.apiKey.startsWith("pk_")) {
        errors.push('CLICKUP_API_KEY should start with "pk_" for personal tokens');
    }
    // Validate project path
    if (!config.project.path) {
        errors.push("PROJECT_PATH is required");
    }
    return {
        isValid: errors.length === 0,
        errors,
    };
}
/**
 * Generate setup instructions
 */
export function generateSetupInstructions() {
    return `
# Auto Work Analyzer Setup Instructions

## Required Environment Variables

Create a .env file in your project root with the following variables:

\`\`\`bash
# ClickUp Configuration (REQUIRED)
CLICKUP_TEAM_ID=your_team_id_here
CLICKUP_API_KEY=pk_your_api_key_here
CLICKUP_DEFAULT_LIST_ID=your_list_id_here

# Project Configuration
PROJECT_NAME=my-project
PROJECT_DESCRIPTION=Description of your project
PROJECT_PATH=/path/to/your/project

# Optional Configuration
WEBHOOK_SECRET=your_webhook_secret_here
WEBHOOK_PORT=3000
GIT_AUTHOR=developer@example.com
AUTO_ANALYSIS=true
ANALYSIS_DAYS_BACK=1
COMPLEXITY_THRESHOLD=50
TIME_ESTIMATE_MULTIPLIER=1.0
LOG_LEVEL=info
LOG_FILE=logs/auto-work-analyzer.log
\`\`\`

## How to Get ClickUp Credentials

1. **Team ID**: 
   - Go to your ClickUp workspace
   - The Team ID is in the URL: https://app.clickup.com/team/{TEAM_ID}/home

2. **API Key**:
   - Click your avatar in ClickUp
   - Go to Settings → Apps
   - Click "Generate" under API Token
   - Copy the token (starts with 'pk_')

3. **List ID** (optional):
   - Go to the specific list in ClickUp
   - The List ID is in the URL: https://app.clickup.com/team/{TEAM_ID}/list/{LIST_ID}

## Usage

Once configured, you can use the Auto Work Analyzer:

\`\`\`bash
# Analyze today's work
npx auto-work-analyzer analyze today

# Analyze specific date range
npx auto-work-analyzer analyze range 2024-01-15 2024-01-16

# Analyze specific author
npx auto-work-analyzer analyze author developer@example.com

# Start webhook server
npx auto-work-analyzer webhook

# Test configuration
npx auto-work-analyzer test
\`\`\`
`;
}
//# sourceMappingURL=index.js.map