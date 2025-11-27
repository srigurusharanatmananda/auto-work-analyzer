# 🚀 Quick Start Guide

## For Kailasa Store Project

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

## For Any Other Project

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

## Environment Variables

Create a `.env` file with your ClickUp credentials:

```bash
# ClickUp Configuration (REQUIRED)
CLICKUP_TEAM_ID=your_team_id_here
CLICKUP_API_KEY=pk_your_api_key_here
CLICKUP_DEFAULT_LIST_ID=your_list_id_here

# Project Configuration
PROJECT_NAME=my-project
PROJECT_DESCRIPTION=Description of your project
PROJECT_PATH=/path/to/your/project
```

## Usage Examples

```bash
# Analyze today's work
npm run analyze today

# Analyze date range
npm run analyze range 2024-01-15 2024-01-16

# Analyze specific author
npm run analyze author developer@example.com

# Don't create tasks (analysis only)
npm run analyze today --no-tasks

# Start webhook server
npm run webhook
```

## Integration Options

1. **Command Line**: `npm run analyze today`
2. **Webhook Server**: `npm run webhook`
3. **Git Hooks**: Copy scripts to your project
4. **Scheduled Jobs**: Add to crontab
5. **CI/CD**: Use webhook endpoints

## Getting ClickUp Credentials

1. **Team ID**: Go to ClickUp → URL contains `team/{TEAM_ID}/home`
2. **API Key**: ClickUp → Settings → Apps → Generate API Token (starts with `pk_`)
3. **List ID**: Go to specific list → URL contains `list/{LIST_ID}`

## What Gets Created

- **Summary Task**: "📊 Daily Work Summary - 2024-01-15"
- **Feature Tasks**: "✅ Feature: Add user authentication system"
- **Bug Fix Tasks**: "🐛 Bug Fix: Fix login form validation error"
- **Improvement Tasks**: "🔧 Improvement: Optimize database queries"
- **Test Tasks**: "🧪 Test: Add unit tests for payment service"

## Troubleshooting

- **"ClickUp credentials not configured"**: Check environment variables
- **"Git repository not found"**: Ensure PROJECT_PATH points to a git repository
- **"No work detected"**: Check if there are commits in the specified date range
- **"Webhook failed"**: Check webhook URL and secret

## Support

- **Documentation**: README.md and USAGE_GUIDE.md
- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: Questions and community support

---

**🎯 This standalone project makes work analysis reusable across all your projects!**


















