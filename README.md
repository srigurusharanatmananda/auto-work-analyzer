# Auto Work Analyzer

**Automatic work analysis and ClickUp task creation based on git commits**

[![npm version](https://badge.fury.io/js/auto-work-analyzer.svg)](https://badge.fury.io/js/auto-work-analyzer)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🎯 What It Does

Auto Work Analyzer intelligently analyzes your git commits and automatically creates ClickUp tasks based on actual work completed. It detects features, bug fixes, improvements, tests, and documentation work, then creates properly organized tasks with subtasks, priorities, and time estimates.

## ✨ Features

- **🧠 Intelligent Work Detection**: Automatically categorizes work into features, bug fixes, improvements, tests, and documentation
- **📊 Smart Analysis**: Analyzes commit messages, file changes, and complexity to determine work type and effort
- **🎯 Automatic Task Creation**: Creates ClickUp tasks with proper descriptions, priorities, and subtasks
- **⏰ Time Tracking**: Estimates work hours based on commit complexity and file changes
- **🏷️ Smart Tagging**: Automatically generates relevant tags based on file types and commit content
- **🔄 Multiple Triggers**: Command line, webhooks, git hooks, scheduled jobs, and CI/CD integration
- **📈 Progress Tracking**: Visual representation of completed work in ClickUp
- **🔧 Highly Configurable**: Works with any project and ClickUp workspace

## 🚀 Quick Start

### Installation

```bash
# Install globally
npm install -g auto-work-analyzer

# Or use with npx (recommended)
npx auto-work-analyzer setup
```

### Configuration

```bash
# Interactive setup
npx auto-work-analyzer setup

# Or create .env file manually
cp env.example .env
# Edit .env with your ClickUp credentials
```

### Basic Usage

```bash
# Analyze today's work and create ClickUp tasks
npx auto-work-analyzer analyze today

# Analyze specific date range
npx auto-work-analyzer analyze range 2024-01-15 2024-01-16

# Analyze work by specific author
npx auto-work-analyzer analyze author developer@example.com

# Test configuration
npx auto-work-analyzer test

# Start webhook server
npx auto-work-analyzer webhook
```

## 📋 Configuration

### Environment Variables

Create a `.env` file in your project root:

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

1. **Team ID**: Go to your ClickUp workspace → URL contains `team/{TEAM_ID}/home`
2. **API Key**: ClickUp → Settings → Apps → Generate API Token (starts with `pk_`)
3. **List ID**: Go to specific list → URL contains `list/{LIST_ID}`

## 🎯 Usage Examples

### Command Line Interface

```bash
# Analyze today's work
npx auto-work-analyzer analyze today

# Analyze date range
npx auto-work-analyzer analyze range 2024-01-15 2024-01-16

# Analyze specific author
npx auto-work-analyzer analyze author developer@example.com

# Don't create tasks (analysis only)
npx auto-work-analyzer analyze today --no-tasks

# JSON output
npx auto-work-analyzer analyze today --output json
```

### Webhook Server

```bash
# Start webhook server
npx auto-work-analyzer webhook --port 3000

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

### Git Hooks

```bash
# Generate git hook
npx auto-work-analyzer setup

# Enable for all branches
export AUTO_WORK_ANALYSIS=true
```

### Scheduled Jobs

```bash
# Add to crontab (crontab -e)
0 9 * * * cd /path/to/project && npx auto-work-analyzer analyze today
```

### CI/CD Integration

#### GitHub Actions

```yaml
name: Auto Work Analysis
on:
  push:
    branches: [main]
  schedule:
    - cron: '0 9 * * *'

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

## 🔧 Advanced Configuration

### Multiple Projects

```bash
# Project 1
PROJECT_NAME=frontend-app
CLICKUP_TEAM_ID=team1
CLICKUP_API_KEY=pk_key1
CLICKUP_DEFAULT_LIST_ID=list1

# Project 2
PROJECT_NAME=backend-api
CLICKUP_TEAM_ID=team2
CLICKUP_API_KEY=pk_key2
CLICKUP_DEFAULT_LIST_ID=list2
```

### Custom Workflows

```typescript
// Create custom workflow templates
const customTemplate = {
  name: 'Custom Workflow',
  description: 'My custom workflow',
  tasks: [
    {
      name: 'Custom Task',
      description: 'Custom task description',
      priority: 'high',
      tags: ['custom', 'workflow'],
    }
  ]
}
```

### Webhook Security

```bash
# Set webhook secret
WEBHOOK_SECRET=your_secret_here

# Use in webhook calls
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{"type": "manual", "secret": "your_secret_here"}'
```

## 🛠️ Troubleshooting

### Common Issues

1. **"ClickUp credentials not configured"**
   - Check environment variables are set correctly
   - Verify API key starts with `pk_`

2. **"Git repository not found"**
   - Ensure you're running from a git repository
   - Check PROJECT_PATH is correct

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
LOG_LEVEL=debug npx auto-work-analyzer analyze today

# Test configuration
npx auto-work-analyzer test
```

## 📈 Benefits

- **Zero Manual Work**: Automatically analyzes your actual commits
- **Intelligent Categorization**: Smart detection of work types
- **Time Tracking**: Automatic time estimates
- **Progress Tracking**: Visual representation of completed work
- **Team Coordination**: Shared understanding of work completed
- **Historical Analysis**: Track work patterns over time
- **Integration**: Works with existing ClickUp workflows

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: [GitHub Wiki](https://github.com/yourusername/auto-work-analyzer/wiki)
- **Issues**: [GitHub Issues](https://github.com/yourusername/auto-work-analyzer/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/auto-work-analyzer/discussions)

## 🙏 Acknowledgments

- Built with TypeScript and Node.js
- Uses ClickUp API for task management
- Inspired by modern development workflows
- Thanks to the open-source community

---

**Made with ❤️ for developers who want to track their work automatically**

