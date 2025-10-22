#!/usr/bin/env node
/**
 * Command Line Interface for Auto Work Analyzer
 */
import { Command } from "commander";
import { GitWorkAnalyzer } from "./services/GitWorkAnalyzer.js";
import { ClickUpService } from "./services/ClickUpService.js";
import { getAppConfig, validateConfig, generateSetupInstructions, } from "./config/index.js";
const program = new Command();
program
    .name("auto-work-analyzer")
    .description("Automatic work analysis and ClickUp task creation based on git commits")
    .version("1.0.0");
// Analyze command
program
    .command("analyze")
    .description("Analyze work and optionally create ClickUp tasks")
    .option("-d, --date <date>", "Start date (YYYY-MM-DD)")
    .option("-e, --end-date <date>", "End date (YYYY-MM-DD)")
    .option("-a, --author <email>", "Author email to filter commits")
    .option("-p, --project <name>", "Project name")
    .option("--no-tasks", "Do not create ClickUp tasks")
    .option("-o, --output <format>", "Output format (json, text, summary)", "text")
    .action(async (options) => {
    try {
        const config = getAppConfig();
        const validation = validateConfig(config);
        if (!validation.isValid) {
            console.error("❌ Configuration invalid:");
            validation.errors.forEach((error) => console.error(`  - ${error}`));
            console.log("\n" + generateSetupInstructions());
            process.exit(1);
        }
        const analyzer = new GitWorkAnalyzer(config.project.path);
        console.log("🔄 Analyzing work...");
        const workAnalysis = await analyzer.analyzeWork(options.date, options.endDate, options.author);
        // Display results
        displayAnalysisResults(workAnalysis, options.output);
        // Create tasks if requested
        if (options.tasks !== false) {
            console.log("\n🎯 Creating ClickUp tasks...");
            const tasks = await analyzer.createTasksFromWork(workAnalysis, config.clickup);
            console.log(`✅ Created ${tasks.length} tasks in ClickUp`);
        }
    }
    catch (error) {
        console.error("❌ Analysis failed:", error instanceof Error ? error.message : "Unknown error");
        process.exit(1);
    }
});
// Today command
program
    .command("today")
    .description("Analyze today's work")
    .option("-a, --author <email>", "Author email to filter commits")
    .option("--no-tasks", "Do not create ClickUp tasks")
    .action(async (options) => {
    try {
        const config = getAppConfig();
        const validation = validateConfig(config);
        if (!validation.isValid) {
            console.error("❌ Configuration invalid:");
            validation.errors.forEach((error) => console.error(`  - ${error}`));
            process.exit(1);
        }
        const analyzer = new GitWorkAnalyzer(config.project.path);
        const today = new Date().toISOString().split("T")[0];
        console.log("🔄 Analyzing today's work...");
        const workAnalysis = await analyzer.analyzeWork(today, undefined, options.author);
        displayAnalysisResults(workAnalysis, "text");
        if (options.tasks !== false) {
            console.log("\n🎯 Creating ClickUp tasks...");
            const tasks = await analyzer.createTasksFromWork(workAnalysis, config.clickup);
            console.log(`✅ Created ${tasks.length} tasks in ClickUp`);
        }
    }
    catch (error) {
        console.error("❌ Analysis failed:", error instanceof Error ? error.message : "Unknown error");
        process.exit(1);
    }
});
// Range command
program
    .command("range")
    .description("Analyze work for a date range")
    .argument("<start-date>", "Start date (YYYY-MM-DD)")
    .argument("<end-date>", "End date (YYYY-MM-DD)")
    .option("-a, --author <email>", "Author email to filter commits")
    .option("--no-tasks", "Do not create ClickUp tasks")
    .action(async (startDate, endDate, options) => {
    try {
        const config = getAppConfig();
        const validation = validateConfig(config);
        if (!validation.isValid) {
            console.error("❌ Configuration invalid:");
            validation.errors.forEach((error) => console.error(`  - ${error}`));
            process.exit(1);
        }
        const analyzer = new GitWorkAnalyzer(config.project.path);
        console.log(`🔄 Analyzing work from ${startDate} to ${endDate}...`);
        const workAnalysis = await analyzer.analyzeWork(startDate, endDate, options.author);
        displayAnalysisResults(workAnalysis, "text");
        if (options.tasks !== false) {
            console.log("\n🎯 Creating ClickUp tasks...");
            const tasks = await analyzer.createTasksFromWork(workAnalysis, config.clickup);
            console.log(`✅ Created ${tasks.length} tasks in ClickUp`);
        }
    }
    catch (error) {
        console.error("❌ Analysis failed:", error instanceof Error ? error.message : "Unknown error");
        process.exit(1);
    }
});
// Author command
program
    .command("author")
    .description("Analyze work by specific author")
    .argument("<email>", "Author email")
    .option("-d, --date <date>", "Date to analyze (YYYY-MM-DD)")
    .option("--no-tasks", "Do not create ClickUp tasks")
    .action(async (email, options) => {
    try {
        const config = getAppConfig();
        const validation = validateConfig(config);
        if (!validation.isValid) {
            console.error("❌ Configuration invalid:");
            validation.errors.forEach((error) => console.error(`  - ${error}`));
            process.exit(1);
        }
        const analyzer = new GitWorkAnalyzer(config.project.path);
        console.log(`🔄 Analyzing work by ${email}...`);
        const workAnalysis = await analyzer.analyzeWork(options.date, undefined, email);
        displayAnalysisResults(workAnalysis, "text");
        if (options.tasks !== false) {
            console.log("\n🎯 Creating ClickUp tasks...");
            const tasks = await analyzer.createTasksFromWork(workAnalysis, config.clickup);
            console.log(`✅ Created ${tasks.length} tasks in ClickUp`);
        }
    }
    catch (error) {
        console.error("❌ Analysis failed:", error instanceof Error ? error.message : "Unknown error");
        process.exit(1);
    }
});
// Test command
program
    .command("test")
    .description("Test configuration and connectivity")
    .action(async () => {
    try {
        const config = getAppConfig();
        const validation = validateConfig(config);
        if (!validation.isValid) {
            console.error("❌ Configuration invalid:");
            validation.errors.forEach((error) => console.error(`  - ${error}`));
            console.log("\n" + generateSetupInstructions());
            process.exit(1);
        }
        console.log("🧪 Testing configuration...");
        console.log(`✅ Project: ${config.project.name}`);
        console.log(`✅ Path: ${config.project.path}`);
        console.log(`✅ ClickUp Team: ${config.clickup.teamId}`);
        console.log(`✅ API Key: ${config.clickup.apiKey.substring(0, 8)}...`);
        // Test ClickUp connectivity
        console.log("\n🔗 Testing ClickUp connectivity...");
        const clickUpService = new ClickUpService(config.clickup);
        const teamInfo = await clickUpService.getTeamInfo();
        console.log(`✅ ClickUp connected: ${teamInfo.name}`);
        // Test git repository
        console.log("\n📁 Testing git repository...");
        const analyzer = new GitWorkAnalyzer(config.project.path);
        const workAnalysis = await analyzer.analyzeWork();
        console.log(`✅ Git repository accessible`);
        console.log(`📊 Recent commits: ${workAnalysis.totalCommits}`);
        console.log("\n🎉 All tests passed! Configuration is valid.");
    }
    catch (error) {
        console.error("❌ Test failed:", error instanceof Error ? error.message : "Unknown error");
        process.exit(1);
    }
});
// Setup command
program
    .command("setup")
    .description("Generate setup instructions and configuration template")
    .action(() => {
    console.log(generateSetupInstructions());
});
// Webhook command
program
    .command("webhook")
    .description("Start webhook server for automatic analysis")
    .option("-p, --port <port>", "Port to run webhook server on", "3000")
    .action(async (options) => {
    try {
        const { startWebhookServer } = await import("./webhook-server.js");
        await startWebhookServer(parseInt(options.port));
    }
    catch (error) {
        console.error("❌ Webhook server failed:", error instanceof Error ? error.message : "Unknown error");
        process.exit(1);
    }
});
/**
 * Display analysis results
 */
function displayAnalysisResults(workAnalysis, format) {
    if (format === "json") {
        console.log(JSON.stringify(workAnalysis, null, 2));
        return;
    }
    console.log(`\n📊 Analysis Results:`);
    console.log(`  Date: ${workAnalysis.date}`);
    console.log(`  Commits: ${workAnalysis.totalCommits}`);
    console.log(`  Files changed: ${workAnalysis.totalFilesChanged}`);
    console.log(`  Lines: +${workAnalysis.totalLinesAdded} -${workAnalysis.totalLinesDeleted}`);
    console.log(`  Work items: ${workAnalysis.detectedWork.length}`);
    if (workAnalysis.detectedWork.length > 0) {
        console.log("\n📋 Detected work:");
        workAnalysis.detectedWork.forEach((work, index) => {
            console.log(`  ${index + 1}. ${work.type.toUpperCase()}: ${work.name}`);
            console.log(`     Files: ${work.files.length}, Hours: ${work.estimatedHours}`);
            console.log(`     Tags: ${work.tags.join(", ")}`);
        });
    }
    else {
        console.log("\nℹ️  No significant work detected");
    }
    if (format === "summary") {
        console.log(`\n📝 Summary:`);
        console.log(workAnalysis.summary);
    }
}
// Parse command line arguments
program.parse();
//# sourceMappingURL=cli.js.map