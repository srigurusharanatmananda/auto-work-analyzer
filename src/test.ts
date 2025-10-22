/**
 * Test script for Auto Work Analyzer
 *
 * Tests the configuration and functionality of the Auto Work Analyzer.
 */

import { GitWorkAnalyzer } from "./services/GitWorkAnalyzer.js";
import { ClickUpService } from "./services/ClickUpService.js";
import { getAppConfig, validateConfig } from "./config/index.js";

/**
 * Test configuration
 */
async function testConfiguration(): Promise<boolean> {
  try {
    console.log("🧪 Testing configuration...");

    const config = getAppConfig();
    const validation = validateConfig(config);

    if (!validation.isValid) {
      console.error("❌ Configuration invalid:");
      validation.errors.forEach((error) => console.error(`  - ${error}`));
      return false;
    }

    console.log("✅ Configuration is valid");
    console.log(`📁 Project: ${config.project.name}`);
    console.log(`📂 Path: ${config.project.path}`);
    console.log(`🔗 ClickUp Team: ${config.clickup.teamId}`);
    console.log(`🔑 API Key: ${config.clickup.apiKey.substring(0, 8)}...`);

    return true;
  } catch (error) {
    console.error(
      "❌ Configuration test failed:",
      error instanceof Error ? error.message : "Unknown error"
    );
    return false;
  }
}

/**
 * Test ClickUp connectivity
 */
async function testClickUpConnectivity(): Promise<boolean> {
  try {
    console.log("\n🔗 Testing ClickUp connectivity...");

    const config = getAppConfig();
    const clickUpService = new ClickUpService(config.clickup);

    const teamInfo = await clickUpService.getTeamInfo();
    console.log(`✅ ClickUp connected: ${teamInfo.name}`);

    return true;
  } catch (error) {
    console.error(
      "❌ ClickUp connectivity test failed:",
      error instanceof Error ? error.message : "Unknown error"
    );
    return false;
  }
}

/**
 * Test git repository access
 */
async function testGitRepository(): Promise<boolean> {
  try {
    console.log("\n📁 Testing git repository access...");

    const config = getAppConfig();
    const analyzer = new GitWorkAnalyzer(config.project.path);

    const workAnalysis = await analyzer.analyzeWork();
    console.log(`✅ Git repository accessible`);
    console.log(`📊 Recent commits: ${workAnalysis.totalCommits}`);
    console.log(`📁 Files changed: ${workAnalysis.totalFilesChanged}`);
    console.log(
      `📊 Lines: +${workAnalysis.totalLinesAdded} -${workAnalysis.totalLinesDeleted}`
    );

    return true;
  } catch (error) {
    console.error(
      "❌ Git repository test failed:",
      error instanceof Error ? error.message : "Unknown error"
    );
    return false;
  }
}

/**
 * Test work analysis
 */
async function testWorkAnalysis(): Promise<boolean> {
  try {
    console.log("\n🔍 Testing work analysis...");

    const config = getAppConfig();
    const analyzer = new GitWorkAnalyzer(config.project.path);

    const workAnalysis = await analyzer.analyzeWork();
    console.log(`✅ Work analysis completed`);
    console.log(`🔍 Work items detected: ${workAnalysis.detectedWork.length}`);

    if (workAnalysis.detectedWork.length > 0) {
      console.log("\n📋 Detected work:");
      workAnalysis.detectedWork.forEach((work, index) => {
        console.log(`  ${index + 1}. ${work.type.toUpperCase()}: ${work.name}`);
        console.log(
          `     Files: ${work.files.length}, Hours: ${work.estimatedHours}`
        );
        console.log(`     Tags: ${work.tags.join(", ")}`);
      });
    } else {
      console.log("ℹ️  No significant work detected");
    }

    return true;
  } catch (error) {
    console.error(
      "❌ Work analysis test failed:",
      error instanceof Error ? error.message : "Unknown error"
    );
    return false;
  }
}

/**
 * Test task creation (dry run)
 */
async function testTaskCreation(): Promise<boolean> {
  try {
    console.log("\n🎯 Testing task creation (dry run)...");

    const config = getAppConfig();
    const analyzer = new GitWorkAnalyzer(config.project.path);

    const workAnalysis = await analyzer.analyzeWork();

    if (workAnalysis.detectedWork.length > 0) {
      console.log("✅ Task creation test passed (dry run)");
      console.log(
        `📋 Would create ${
          workAnalysis.detectedWork.length + 1
        } tasks (1 summary + ${workAnalysis.detectedWork.length} individual)`
      );
    } else {
      console.log(
        "ℹ️  No tasks would be created (no significant work detected)"
      );
    }

    return true;
  } catch (error) {
    console.error(
      "❌ Task creation test failed:",
      error instanceof Error ? error.message : "Unknown error"
    );
    return false;
  }
}

/**
 * Run all tests
 */
async function runAllTests(): Promise<void> {
  console.log("🚀 Auto Work Analyzer Test Suite");
  console.log("=================================");

  const tests = [
    { name: "Configuration", fn: testConfiguration },
    { name: "ClickUp Connectivity", fn: testClickUpConnectivity },
    { name: "Git Repository", fn: testGitRepository },
    { name: "Work Analysis", fn: testWorkAnalysis },
    { name: "Task Creation", fn: testTaskCreation },
  ];

  const results = [];

  for (const test of tests) {
    try {
      const success = await test.fn();
      results.push({ name: test.name, success });
    } catch (error) {
      console.error(`❌ ${test.name} test crashed:`, error);
      results.push({ name: test.name, success: false });
    }
  }

  // Summary
  console.log("\n📊 Test Summary");
  console.log("===============");

  const successfulTests = results.filter((r) => r.success).length;
  const totalTests = results.length;

  results.forEach((result) => {
    console.log(`${result.success ? "✅" : "❌"} ${result.name}`);
  });

  console.log(`\nTotal tests: ${totalTests}`);
  console.log(`Successful: ${successfulTests}`);
  console.log(`Failed: ${totalTests - successfulTests}`);
  console.log(
    `Success rate: ${Math.round((successfulTests / totalTests) * 100)}%`
  );

  if (successfulTests === totalTests) {
    console.log("\n🎉 All tests passed! Auto Work Analyzer is ready to use.");
  } else {
    console.log(
      "\n⚠️  Some tests failed. Check the configuration and try again."
    );
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().catch((error) => {
    console.error("Test suite failed:", error);
    process.exit(1);
  });
}

