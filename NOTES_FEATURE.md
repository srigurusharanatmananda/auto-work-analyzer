# Notes Upload Feature - Quick Start Guide

The notes upload feature allows you to convert your informal notes into structured ClickUp tasks automatically.

## Quick Start

### 1. Start the Webhook Server
```bash
npm run webhook
```

### 2. Upload Your Notes

#### Method A: Direct Text
```bash
curl -X POST http://localhost:3000/notes \
  -H "Content-Type: application/json" \
  -d '{
    "notes": "- Add user authentication\n- Fix payment bug\n- Improve dashboard performance",
    "createTasks": true
  }'
```

#### Method B: Upload File
```bash
curl -X POST http://localhost:3000/notes \
  -F "notes=@my-notes.txt" \
  -F "createTasks=true"
```

## Supported Note Formats

Your notes can be in any of these formats:

### Bullet Points
```
- Add authentication
- Fix payment flow
* Improve performance
• Update documentation
```

### Numbered Lists
```
1. Implement user login
2. Add password reset
3. Create admin dashboard
```

### TODO Items
```
TODO: Add email verification
FIXME: Fix broken link on homepage
```

### Checkboxes
```
[ ] Setup CI/CD pipeline
[ ] Write unit tests
[ ] Deploy to production
```

### Action Phrases
```
Need to refactor the database queries
Should add error logging
Must fix the security vulnerability
Have to update dependencies
```

### Free-Form Text
```
I noticed the authentication system needs improvement.
We should add two-factor authentication and password reset functionality.
There's also a bug in the payment flow that needs fixing.
```

## Task Classification

The system automatically classifies your notes:

| Keywords | Task Type | Icon |
|----------|-----------|------|
| add, implement, create, build | Feature | ✨ |
| fix, bug, issue, error | Bug Fix | 🐛 |
| improve, enhance, optimize | Improvement | 🔧 |
| test, testing, coverage | Test | 🧪 |
| document, docs, readme | Documentation | 📝 |

## Complexity Estimation

| Keywords | Complexity | Hours |
|----------|------------|-------|
| simple, quick, minor, typo | Low | 1h |
| Default | Medium | 3h |
| architecture, refactor, complex, system | High | 6h |

## Examples

### Example 1: Development Notes
```bash
curl -X POST http://localhost:3000/notes \
  -H "Content-Type: application/json" \
  -d '{
    "notes": "
      - Add OAuth authentication with Google and GitHub
      - Fix the bug where users can\u0027t reset password
      - Improve database query performance
      - Write unit tests for authentication module
      - Document the API endpoints
    ",
    "createTasks": true
  }'
```

**Result:**
- ✨ Add OAuth authentication (Feature, Medium, 3h, tags: security, backend)
- 🐛 Fix password reset bug (Bug Fix, Low, 1h, tags: security)
- 🔧 Improve database query performance (Improvement, Medium, 3h, tags: performance, database)
- 🧪 Write unit tests (Test, Low, 1h, tags: testing)
- 📝 Document API endpoints (Documentation, Low, 1h, tags: documentation)

### Example 2: Meeting Notes
```bash
curl -X POST http://localhost:3000/notes \
  -H "Content-Type: application/json" \
  -d '{
    "notes": "
      Meeting notes from sprint planning:

      Must implement the new dashboard with real-time analytics.
      Need to fix the mobile responsiveness issues.
      Should add pagination to the user list.
      Have to setup automated deployment pipeline.
    ",
    "createTasks": true
  }'
```

### Example 3: Notepad File
**my-notes.txt:**
```
Daily TODO:
1. Refactor the authentication service
2. Add logging to all API endpoints
3. Fix broken tests in the payment module
4. Update deployment documentation
5. Implement rate limiting for API
```

**Upload:**
```bash
curl -X POST http://localhost:3000/notes \
  -F "notes=@my-notes.txt" \
  -F "createTasks=true"
```

## API Response

```json
{
  "success": true,
  "data": {
    "processedNotes": {
      "totalTasks": 3,
      "tasks": [
        {
          "name": "Add user authentication",
          "type": "feature",
          "complexity": "medium",
          "estimatedHours": 3,
          "tags": ["from-notes", "security", "backend"]
        },
        {
          "name": "Fix payment bug",
          "type": "bug-fix",
          "complexity": "low",
          "estimatedHours": 1,
          "tags": ["from-notes", "payment"]
        },
        {
          "name": "Improve dashboard performance",
          "type": "improvement",
          "complexity": "medium",
          "estimatedHours": 3,
          "tags": ["from-notes", "performance", "frontend"]
        }
      ]
    },
    "createdTasks": [
      {
        "id": "abc123",
        "name": "✨ Add user authentication",
        "url": "https://app.clickup.com/t/abc123"
      },
      {
        "id": "def456",
        "name": "🐛 Fix payment bug",
        "url": "https://app.clickup.com/t/def456"
      },
      {
        "id": "ghi789",
        "name": "🔧 Improve dashboard performance",
        "url": "https://app.clickup.com/t/ghi789"
      }
    ],
    "summary": {
      "tasksExtracted": 3,
      "tasksCreated": 3
    }
  },
  "message": "Processed 3 tasks from notes, created 3 ClickUp tasks"
}
```

## Tips

### 1. Be Specific
❌ Bad: "Fix stuff"
✅ Good: "Fix login button not responding on mobile"

### 2. Use Action Verbs
❌ Bad: "Authentication"
✅ Good: "Add authentication with OAuth"

### 3. One Task Per Line
❌ Bad: "Add auth and fix bug and improve UI"
✅ Good:
```
- Add authentication
- Fix login bug
- Improve UI layout
```

### 4. Include Context
❌ Bad: "Update it"
✅ Good: "Update user profile API endpoint to include avatar"

### 5. Indicate Urgency
For high priority tasks, use words like:
- "urgent", "critical", "blocking"
- "major", "important", "must"

## File Upload Limits

- **Max file size:** 5MB
- **Supported formats:** .txt, .md
- **Encoding:** UTF-8

## Preview Mode

To see what tasks would be created without actually creating them:

```bash
curl -X POST http://localhost:3000/notes \
  -H "Content-Type: application/json" \
  -d '{
    "notes": "- Add authentication\n- Fix bug",
    "createTasks": false
  }'
```

This returns the processed tasks without creating them in ClickUp.

## Integration Examples

### With VS Code Task
Add to `.vscode/tasks.json`:
```json
{
  "label": "Upload Notes to ClickUp",
  "type": "shell",
  "command": "curl -X POST http://localhost:3000/notes -F 'notes=@${file}' -F 'createTasks=true'",
  "problemMatcher": []
}
```

### With GitHub Actions
```yaml
- name: Create tasks from notes
  run: |
    curl -X POST http://localhost:3000/notes \
      -H "Content-Type: application/json" \
      -d "{\"notes\": \"$(cat notes.txt)\", \"createTasks\": true}"
```

### With npm Script
Add to `package.json`:
```json
{
  "scripts": {
    "upload-notes": "curl -X POST http://localhost:3000/notes -F 'notes=@notes.txt' -F 'createTasks=true'"
  }
}
```

## Troubleshooting

### Notes not being extracted
- Ensure notes follow supported formats (bullets, numbers, TODO, etc.)
- Try adding action verbs (add, fix, implement, etc.)
- Check that lines aren't too short (minimum 3 characters)

### Wrong task type assigned
- Include explicit keywords (fix = bug, add = feature, etc.)
- Rephrase to match expected patterns

### Tasks not created in ClickUp
- Verify webhook server is running
- Check ClickUp API credentials in .env
- Look for errors in server logs
- Try with `createTasks: false` first to preview

## Support

For issues or questions about the notes feature, check:
1. Server logs: Look for errors when processing
2. API response: Contains detailed error information
3. IMPROVEMENTS.md: Full documentation of all features

---

**Happy note-taking!** 📝
