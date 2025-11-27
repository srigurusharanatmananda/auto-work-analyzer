/**
 * Setup script for Auto Work Analyzer
 *
 * Helps users configure the tool for their project.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import {
  getAppConfig,
  validateConfig,
  generateSetupInstructions,
} from "./config/index.js";

/**
 * Interactive setup process
 */
export async function interactiveSetup(): Promise<void> {
  console.log("🎯 Auto Work Analyzer Setup");
  console.log("============================");
  console.log("");

  const readline = require("readline");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (prompt: string): Promise<string> => {
    return new Promise((resolve) => {
      rl.question(prompt, resolve);
    });
  };

  try {
    // Check if .env already exists
    if (existsSync(".env")) {
      const overwrite = await question(
        "⚠️  .env file already exists. Overwrite? (y/n): "
      );
      if (overwrite.toLowerCase() !== "y") {
        console.log("Setup cancelled.");
        return;
      }
    }

    console.log("📋 Let's configure your Auto Work Analyzer...");
    console.log("");

    // ClickUp configuration
    console.log("🔗 ClickUp Configuration");
    console.log("------------------------");
    const teamId = await question("ClickUp Team ID: ");
    const apiKey = await question("ClickUp API Key (pk_...): ");
    const listId = await question("ClickUp List ID (optional): ");
    console.log("");

    // Project configuration
    console.log("📁 Project Configuration");
    console.log("------------------------");
    const projectName =
      (await question("Project name: ")) || "Auto Work Analyzer";
    const projectDescription =
      (await question("Project description: ")) ||
      "Automatic work analysis and task creation";
    const projectPath =
      (await question(`Project path (${process.cwd()}): `)) || process.cwd();
    console.log("");

    // Optional configuration
    console.log("⚙️  Optional Configuration");
    console.log("--------------------------");
    const webhookSecret = await question("Webhook secret (optional): ");
    const webhookPort = (await question("Webhook port (3000): ")) || "3000";
    const gitAuthor = await question("Git author email (optional): ");
    console.log("");

    // Generate .env file
    const envContent = generateEnvFile({
      teamId,
      apiKey,
      listId,
      projectName,
      projectDescription,
      projectPath,
      webhookSecret,
      webhookPort,
      gitAuthor,
    });

    writeFileSync(".env", envContent);
    console.log("✅ Created .env file");

    // Create logs directory
    if (!existsSync("logs")) {
      mkdirSync("logs", { recursive: true });
      console.log("✅ Created logs directory");
    }

    // Test configuration
    console.log("");
    console.log("🧪 Testing configuration...");

    try {
      const config = getAppConfig();
      const validation = validateConfig(config);

      if (validation.isValid) {
        console.log("✅ Configuration is valid!");
        console.log("");
        console.log("🎉 Setup complete! You can now use:");
        console.log("  npx auto-work-analyzer analyze today");
        console.log("  npx auto-work-analyzer test");
        console.log("  npx auto-work-analyzer webhook");
      } else {
        console.log("❌ Configuration has errors:");
        validation.errors.forEach((error) => console.log(`  - ${error}`));
      }
    } catch (error) {
      console.log(
        "❌ Configuration test failed:",
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  } finally {
    rl.close();
  }
}

/**
 * Generate .env file content
 */
function generateEnvFile(config: {
  teamId: string;
  apiKey: string;
  listId: string;
  projectName: string;
  projectDescription: string;
  projectPath: string;
  webhookSecret: string;
  webhookPort: string;
  gitAuthor: string;
}): string {
  return `# Auto Work Analyzer Configuration
# Generated on ${new Date().toISOString()}

# ClickUp Configuration (REQUIRED)
CLICKUP_TEAM_ID=${config.teamId}
CLICKUP_API_KEY=${config.apiKey}
${
  config.listId
    ? `CLICKUP_DEFAULT_LIST_ID=${config.listId}`
    : "# CLICKUP_DEFAULT_LIST_ID=your_list_id_here"
}

# Project Configuration
PROJECT_NAME=${config.projectName}
PROJECT_DESCRIPTION=${config.projectDescription}
PROJECT_PATH=${config.projectPath}

# Webhook Configuration (Optional)
${
  config.webhookSecret
    ? `WEBHOOK_SECRET=${config.webhookSecret}`
    : "# WEBHOOK_SECRET=your_webhook_secret_here"
}
WEBHOOK_PORT=${config.webhookPort}

# Git Configuration (Optional)
${
  config.gitAuthor
    ? `GIT_AUTHOR=${config.gitAuthor}`
    : "# GIT_AUTHOR=developer@example.com"
}

# Analysis Configuration
ANALYSIS_DAYS_BACK=1
COMPLEXITY_THRESHOLD=50
TIME_ESTIMATE_MULTIPLIER=1.0

# Logging
LOG_LEVEL=info
LOG_FILE=logs/auto-work-analyzer.log
`;
}

/**
 * Generate git hooks
 */
export function generateGitHooks(): void {
  const postCommitHook = `#!/bin/bash

# Auto Work Analyzer Git Hook
# Automatically analyzes work and creates ClickUp tasks after each commit

# Configuration
PROJECT_PATH="${process.cwd()}"
WEBHOOK_URL="http://localhost:3000/webhook"
WEBHOOK_SECRET="${process.env.WEBHOOK_SECRET || ""}"

# Get commit information
COMMIT_HASH=$(git rev-parse HEAD)
COMMIT_AUTHOR=$(git log -1 --pretty=format:"%an <%ae>")
COMMIT_DATE=$(git log -1 --pretty=format:"%ad" --date=short)
COMMIT_MESSAGE=$(git log -1 --pretty=format:"%s")
BRANCH_NAME=$(git branch --show-current)

# Only trigger for main/master branches or if explicitly enabled
if [[ "$BRANCH_NAME" != "main" && "$BRANCH_NAME" != "master" && "$AUTO_WORK_ANALYSIS" != "true" ]]; then
    echo "Skipping Auto Work Analyzer for branch: $BRANCH_NAME"
    echo "Set AUTO_WORK_ANALYSIS=true to enable for all branches"
    exit 0
fi

echo "🔄 Auto Work Analyzer: Analyzing work and creating ClickUp tasks..."
echo "📝 Commit: $COMMIT_MESSAGE"
echo "👤 Author: $COMMIT_AUTHOR"
echo "📅 Date: $COMMIT_DATE"
echo "🌿 Branch: $BRANCH_NAME"

# Prepare webhook payload
PAYLOAD=$(cat <<EOF
{
  "type": "git-push",
  "project": "${process.env.PROJECT_NAME || "auto-work-analyzer"}",
  "date": "$COMMIT_DATE",
  "author": "$COMMIT_AUTHOR",
  "branch": "$BRANCH_NAME",
  "repository": "$(git remote get-url origin 2>/dev/null || echo 'local')",
  "commitHash": "$COMMIT_HASH",
  "secret": "$WEBHOOK_SECRET"
}
EOF
)

# Send webhook request
RESPONSE=$(curl -s -X POST "$WEBHOOK_URL" \\
  -H "Content-Type: application/json" \\
  -d "$PAYLOAD" \\
  -w "\\n%{http_code}")

# Extract HTTP status code
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
RESPONSE_BODY=$(echo "$RESPONSE" | head -n -1)

# Check if request was successful
if [[ "$HTTP_CODE" -eq 200 ]]; then
    echo "✅ Auto Work Analyzer: Tasks created successfully!"
    
    # Extract task count from response
    TASK_COUNT=$(echo "$RESPONSE_BODY" | grep -o '"tasksCreated":[0-9]*' | cut -d':' -f2)
    if [[ -n "$TASK_COUNT" && "$TASK_COUNT" -gt 0 ]]; then
        echo "📋 Created $TASK_COUNT tasks in ClickUp"
    else
        echo "ℹ️  No new tasks created (no significant work detected)"
    fi
else
    echo "❌ Auto Work Analyzer: Failed to create tasks (HTTP $HTTP_CODE)"
    echo "Response: $RESPONSE_BODY"
fi

echo "🔗 Webhook URL: $WEBHOOK_URL"
echo "📊 Project: ${process.env.PROJECT_NAME || "auto-work-analyzer"}"
`;

  // Write git hook
  const gitHooksDir = join(process.cwd(), ".git", "hooks");
  if (existsSync(gitHooksDir)) {
    writeFileSync(join(gitHooksDir, "post-commit"), postCommitHook);
    // Make it executable
    require("child_process").execSync(
      `chmod +x ${join(gitHooksDir, "post-commit")}`
    );
    console.log("✅ Created git post-commit hook");
  } else {
    console.log("⚠️  Git repository not found, skipping git hook creation");
  }
}

/**
 * Generate cron job
 */
export function generateCronJob(): string {
  const projectPath = process.cwd();
  const scriptPath = join(
    projectPath,
    "node_modules",
    ".bin",
    "auto-work-analyzer"
  );

  return `# Auto Work Analyzer Cron Job
# Add this to your crontab (crontab -e)

# Daily analysis at 9 AM
0 9 * * * cd ${projectPath} && ${scriptPath} analyze today

# Weekly analysis every Monday at 9 AM
0 9 * * 1 cd ${projectPath} && ${scriptPath} analyze range $(date -d '7 days ago' +%Y-%m-%d) $(date -d '1 day ago' +%Y-%m-%d)
`;
}

// Run setup if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  interactiveSetup().catch((error) => {
    console.error("Setup failed:", error);
    process.exit(1);
  });
}


















