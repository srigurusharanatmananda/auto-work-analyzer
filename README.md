# Auto Work Analyzer

**Automatic work analysis and ClickUp task creation based on git commits**

> **Picking this up mid-stream?** Start with **[STATUS.md](STATUS.md)** — what is
> done, what is next, and the landmines. This README predates the Postgres move
> and the call-transcript module.

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

## 🗄️ Database

Postgres, required. Every store reads it and the server refuses to start if it
cannot connect — better a clear failure at boot than a server that accepts
traffic and errors on every request.

```bash
createdb auto_work_analyzer
echo 'DATABASE_URL=postgres://localhost:5432/auto_work_analyzer' >> .env
bun run db:migrate            # apply the schema
```

**Upgrading from the SQLite version?** Your data is in
`.database/auto-work-analyzer.db` and is copied across in one step. The source
is opened read-only, the copy runs in a single transaction, and it re-counts
both databases afterwards rather than trusting its own bookkeeping:

```bash
bun run db:import             # add --sqlite <path> for a non-default location
```

It refuses to run into a database that already holds data, so it is safe to try.
(The three built-in templates the server seeds on start do not count — otherwise
starting the server once would lock you out of importing.)

Schema changes go through Drizzle: edit `src/db/schema.ts`, then
`bun run db:generate` to produce a migration in `src/db/migrations/`. Do not
hand-edit a generated migration that has already been applied anywhere.

`bun run test:db` needs a reachable Postgres — it creates a throwaway schema per
test file and drops it afterwards. Set `TEST_DATABASE_URL` to keep it away from
your development database. It fails rather than skips when Postgres is missing,
because a database suite that passes without a database proves nothing.

## 📋 Configuration

### Environment Variables

Create a `.env` file in your project root:

```bash
# Credential encryption (REQUIRED)
CREDENTIAL_ENCRYPTION_KEY=base64_32_byte_key

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

### Credential encryption key

Saved ClickUp destinations keep their API key encrypted at rest (AES-256-GCM),
so `CREDENTIAL_ENCRYPTION_KEY` is required and the server **refuses to start**
without it — storing keys in the clear is not offered as a fallback. Generate
one with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Keep it somewhere durable. Losing it does not lose your ClickUp account, but
every stored destination becomes undecryptable and its key has to be pasted in
again.

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
  name: "Custom Workflow",
  description: "My custom workflow",
  tasks: [
    {
      name: "Custom Task",
      description: "Custom task description",
      priority: "high",
      tags: ["custom", "workflow"],
    },
  ],
};
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

## 📅 Daily Repo Scan

Scans every locally-cloned repository in your GitHub organisation and creates the
day's ClickUp tasks — so working across a dozen repos does not mean running a
report a dozen times.

Configure it at **Settings → Daily Repo Scan** (`/settings/scanning`).

**How repositories are found.** The scan walks a root directory one level deep and
reads each clone's `git remote`. A clone whose remote owner matches your configured
organisation is in scope; everything else is listed as skipped, with a reason, so a
repository you expected but do not see explains itself. There is **no GitHub token
and no GitHub API call** — a clone already states its owner.

Consequently: **a repository must be cloned locally to be scanned.** Work pushed
from another machine to a repo you have never cloned here is invisible.

**Whose commits.** Add every identity you commit under — work email, personal
email, a GitHub noreply address. A single identity silently finds nothing in
repositories where you commit as someone else, which looks identical to having done
no work. With no identities set, every commit by everyone is reported.

**Where tasks go.** Each repository can be bound to a ClickUp destination and a
template; anything unbound uses your default destination. Every task is tagged with
the `owner/repo` slug.

**Freshness.** Each repository is `git fetch`ed before scanning. A fetch that fails
— no credentials, no network — is reported and the repository is still scanned
against its local history, flagged so you know it may be stale.

**Safety.**

- Scanning ships **disabled**. Nothing is created unattended until you enable it.
- **Dry run** reports exactly what would be created and writes nothing — not to
  ClickUp, not to the database. It is the safe way to try this.
- Re-running is safe: commits already turned into tasks are skipped, so a second
  run the same day creates nothing.
- A repository that fails does not stop the others, and every outcome appears in
  the run summary.

**Scheduling.** The scan fires at your configured local time. Because the scheduler
only runs while the server does, a missed day is caught up the next time the server
starts — each missed day scanned as itself, bounded to the last 7 days. A run that
fails is not marked complete, so it retries rather than being skipped.

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

















