# Auto Work Analyzer - Usage Guide

This is a **standalone, reusable project** for automatic work analysis and ClickUp task creation. It can be used with **any project** and **any ClickUp workspace**.

## 🎯 What This Solves

Instead of having work analysis code embedded in each project, this creates a **dedicated tool** that can:

- ✅ Work with **any git repository**
- ✅ Connect to **any ClickUp workspace**
- ✅ Be installed **globally** or **per-project**
- ✅ Be used across **multiple projects**
- ✅ Be **easily maintained** and **updated**

## 🚀 Quick Start

### Option 1: Use with Kailasa Store (Current Project)

```bash
# Navigate to the auto-work-analyzer directory
cd /Users/zacchaeusnapuo/Documents/GitHub/auto-work-analyzer

# Run the Kailasa Store setup script
./scripts/setup-kailasa.sh

# Test the configuration
npm run test

# Analyze today's work
npm run analyze today

# Start webhook server
npm run webhook
```

### Option 2: Use with Any Other Project

```bash
# Navigate to the auto-work-analyzer directory
cd /Users/zacchaeusnapuo/Documents/GitHub/auto-work-analyzer

# Run interactive setup
npm run setup

# Or manually configure .env file
cp env.example .env
# Edit .env with your ClickUp credentials

# Test configuration
npm run test

# Analyze work
npm run analyze today
```

### Option 3: Install Globally

```bash
# Install globally
npm install -g auto-work-analyzer

# Use from anywhere
auto-work-analyzer analyze today
auto-work-analyzer test
auto-work-analyzer webhook
```

## 📁 Project Structure

```
auto-work-analyzer/
├── src/
│   ├── services/
│   │   ├── GitWorkAnalyzer.ts      # Core git analysis logic
│   │   └── ClickUpService.ts       # ClickUp API integration
│   ├── config/
│   │   └── index.ts                # Configuration management
│   ├── types/
│   │   └── index.ts                # TypeScript type definitions
│   ├── cli.ts                      # Command line interface
│   ├── webhook-server.ts          # Webhook server
│   ├── setup.ts                   # Interactive setup
│   ├── test.ts                    # Test suite
│   └── index.ts                   # Main library exports
├── scripts/
│   ├── install.sh                 # Installation script
│   └── setup-kailasa.sh           # Kailasa Store setup
├── package.json                   # Dependencies and scripts
├── tsconfig.json                  # TypeScript configuration
├── env.example                    # Environment template
├── README.md                      # Main documentation
└── USAGE_GUIDE.md                 # This file
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the `auto-work-analyzer` directory:

```bash
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
```

### Getting ClickUp Credentials

1. **Team ID**: Go to ClickUp → URL contains `team/{TEAM_ID}/home`
2. **API Key**: ClickUp → Settings → Apps → Generate API Token (starts with `pk_`)
3. **List ID**: Go to specific list → URL contains `list/{LIST_ID}`

## 📋 Usage Examples

### Command Line Interface

```bash
# Analyze today's work
npm run analyze today

# Analyze date range
npm run analyze range 2024-01-15 2024-01-16

# Analyze specific author
npm run analyze author developer@example.com

# Don't create tasks (analysis only)
npm run analyze today --no-tasks

# JSON output
npm run analyze today --output json

# Test configuration
npm run test

# Start webhook server
npm run webhook
```

### Webhook Server

```bash
# Start webhook server
npm run webhook

# Health check
curl http://localhost:3000/health

# Manual analysis
curl -X POST http://localhost:3000/analyze \
  -H "Content-Type: application/json" \
  -d '{"date": "2024-01-15", "createTasks": true}'

# Webhook trigger
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{"type": "manual", "date": "2024-01-15"}'
```

### Programmatic Usage

```typescript
import { analyzeWork, createTasksFromWork } from "auto-work-analyzer";

// Analyze work
const result = await analyzeWork({
  date: "2024-01-15",
  createTasks: true,
  projectPath: "/path/to/project",
});

console.log("Work analysis:", result.workAnalysis);
console.log("Created tasks:", result.createdTasks);
```

## 🔄 Integration Options

### 1. Command Line (Manual)

```bash
# Run analysis manually
npm run analyze today
```

### 2. Webhook Server (Automatic)

```bash
# Start webhook server
npm run webhook

# Trigger from external systems
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{"type": "git-push", "project": "my-project"}'
```

### 3. Git Hooks (Automatic)

```bash
# Copy git hook to your project
cp scripts/git-hooks/post-commit /path/to/your/project/.git/hooks/post-commit
chmod +x /path/to/your/project/.git/hooks/post-commit

# Enable for all branches
export AUTO_WORK_ANALYSIS=true
```

### 4. Scheduled Jobs (Automatic)

```bash
# Add to crontab (crontab -e)
0 9 * * * cd /path/to/auto-work-analyzer && npm run analyze today
```

### 5. CI/CD Integration

#### GitHub Actions

```yaml
name: Auto Work Analysis
on:
  push:
    branches: [main]
  schedule:
    - cron: "0 9 * * *"

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Analyze work
        run: |
          curl -X POST ${{ secrets.WEBHOOK_URL }}/webhook \
            -H "Content-Type: application/json" \
            -d '{"type": "ci-cd", "project": "my-project"}'
```

#### GitLab CI

```yaml
analyze_work:
  stage: deploy
  script:
    - |
      curl -X POST $WEBHOOK_URL/webhook \
        -H "Content-Type: application/json" \
        -d '{"type": "ci-cd", "project": "my-project"}'
```

## 🎯 Multiple Projects Setup

### Option 1: Multiple .env Files

```bash
# Project 1
cp .env .env.project1
# Edit .env.project1 with Project 1 credentials

# Project 2
cp .env .env.project2
# Edit .env.project2 with Project 2 credentials

# Use specific environment
cp .env.project1 .env
npm run analyze today
```

### Option 2: Environment Variables

```bash
# Project 1
PROJECT_PATH=/path/to/project1 CLICKUP_TEAM_ID=team1 CLICKUP_API_KEY=pk_key1 npm run analyze today

# Project 2
PROJECT_PATH=/path/to/project2 CLICKUP_TEAM_ID=team2 CLICKUP_API_KEY=pk_key2 npm run analyze today
```

### Option 3: Separate Instances

```bash
# Clone for each project
git clone auto-work-analyzer project1-analyzer
git clone auto-work-analyzer project2-analyzer

# Configure each separately
cd project1-analyzer && npm run setup
cd project2-analyzer && npm run setup
```

## 🧠 How It Works

### Work Detection Patterns

- **Features**: `add`, `implement`, `create`, `build`, `develop`
- **Bug Fixes**: `fix`, `resolve`, `correct`, `repair`, `bug`
- **Improvements**: `improve`, `enhance`, `optimize`, `refactor`, `update`
- **Tests**: `test`, `add test`, `unit test`, `integration test`
- **Documentation**: `doc`, `document`, `readme`, `docs`

### Complexity Analysis

- **Low**: < 50 lines changed, ≤ 3 files
- **Medium**: 50-200 lines changed, ≤ 10 files
- **High**: > 200 lines changed, > 10 files

### Time Estimation

- **Low**: 0.5 hours
- **Medium**: 2 hours
- **High**: 4 hours
- Adjusted by file count multiplier

### Smart Tagging

- **File-based**: `frontend`, `backend`, `styling`, `testing`, `api`, `components`
- **Message-based**: `authentication`, `payment`, `analytics`, `admin`, `ui-ux`
- **Context-based**: `utilities`, `integration`, `performance`

## 📊 What Gets Created in ClickUp

### Summary Task

- **Name**: "📊 Daily Work Summary - 2024-01-15"
- **Description**: Complete analysis of work completed
- **Subtasks**: One for each detected work item

### Individual Tasks

- **Feature Tasks**: "✅ Feature: Add user authentication system"
- **Bug Fix Tasks**: "🐛 Bug Fix: Fix login form validation error"
- **Improvement Tasks**: "🔧 Improvement: Optimize database queries"
- **Test Tasks**: "🧪 Test: Add unit tests for payment service"

### Smart Features

- **Priority**: Based on complexity (high/medium/low)
- **Tags**: Auto-generated based on file types and content
- **Time Estimates**: Calculated from commit complexity
- **Status**: Automatically marked as complete
- **Descriptions**: Detailed with file changes and commit info

## 🛠️ Troubleshooting

### Common Issues

1. **"ClickUp credentials not configured"**

   - Check environment variables are set correctly
   - Verify API key starts with `pk_`

2. **"Git repository not found"**

   - Ensure PROJECT_PATH points to a git repository
   - Check the path is correct

3. **"No work detected"**

   - Check if there are commits in the specified date range
   - Verify author email matches git commit author
   - Ensure commits have meaningful messages

4. **"Webhook failed"**
   - Check webhook URL is accessible
   - Verify webhook secret if configured
   - Check server logs for detailed errors

### Debug Mode

```bash
# Enable debug logging
LOG_LEVEL=debug npm run analyze today

# Test configuration
npm run test
```

## 📈 Benefits

- **Reusable**: Works with any project and ClickUp workspace
- **Maintainable**: Single codebase for all projects
- **Scalable**: Easy to add new projects and features
- **Flexible**: Multiple integration options
- **Intelligent**: Smart work detection and categorization
- **Automated**: Reduces manual task creation
- **Trackable**: Visual representation of completed work

## 🎉 Getting Started

1. **Clone the repository**

   ```bash
   git clone auto-work-analyzer
   cd auto-work-analyzer
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure for your project**

   ```bash
   npm run setup
   # Or manually edit .env file
   ```

4. **Test configuration**

   ```bash
   npm run test
   ```

5. **Analyze work**

   ```bash
   npm run analyze today
   ```

6. **Set up automation** (optional)
   - Git hooks
   - Scheduled jobs
   - CI/CD integration
   - Webhook server

## 📚 Documentation

- **README.md**: Main documentation
- **USAGE_GUIDE.md**: This file
- **GitHub Wiki**: Detailed guides
- **GitHub Issues**: Support and bug reports

## 🆘 Support

- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: Questions and community support
- **Documentation**: Comprehensive guides and examples

---

**🎯 This standalone project makes work analysis reusable across all your projects!**
