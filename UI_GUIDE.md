# Auto Work Analyzer - Web UI Guide

## 🎨 Professional Next.js TypeScript UI

You now have a beautiful, modern web interface for the Auto Work Analyzer built with:

- **Next.js 15** with App Router
- **TypeScript** for type safety
- **Tailwind CSS** for professional styling
- **Auto-Assignment** to Sri Gurusharanatmananda (zacchaeus.napuo@uskfoundation.or.ke)

---

## 🚀 Quick Start

### 1. Start the Backend Server

```bash
# From the root directory
npm run webhook
```

This starts the backend API server on port 3000.

### 2. Start the UI

```bash
# Open a new terminal
cd ui
npm run dev
```

This starts the Next.js development server on port 3001.

### 3. Open Your Browser

Navigate to: **http://localhost:3001**

---

## 📋 Features

### 📊 Analyze Commits Tab

- **Date Range Selection**: Pick start and end dates for analysis
- **Author Filtering**: Filter commits by specific author email
- **Auto Task Creation**: Toggle to automatically create ClickUp tasks
- **Real-time Results**: See analysis results with beautiful visualizations
- **Stats Cards**: View total commits, work items, files changed, and tasks created
- **Auto-Assignment**: All tasks automatically assigned to Sri Gurusharanatmananda

### 📝 Upload Notes Tab

- **Drag & Drop**: Drag .txt or .md files directly into the upload area
- **Manual Paste**: Or paste notes directly into the text area
- **Smart Processing**: Automatically extracts tasks from:
  - Bullet points (`- Task`)
  - Numbered lists (`1. Task`)
  - TODO items (`TODO: Task`)
  - Checkboxes (`[ ] Task`)
  - Action phrases ("Need to...", "Should...", "Must...")
- **Intelligent Classification**: Auto-detects work type (feature, bug, improvement, etc.)
- **Tags & Estimates**: Generates relevant tags and time estimates
- **Auto-Assignment**: Tasks automatically assigned to Sri Gurusharanatmananda

### 📜 View History Tab

- Coming soon! Will show your recent analyses and task creations

---

## 🎨 UI Screenshots

### Home Screen

```
┌────────────────────────────────────────────────────────────────┐
│                   🚀 Auto Work Analyzer                        │
│         Intelligent Git Commit Analysis & Task Management       │
│                                                                │
│  📧 Default Assignee: Sri Gurusharanatmananda                  │
│                                                                │
│  ┌─────────────────┬─────────────────┬──────────────────┐   │
│  │ 📊 Analyze      │ 📝 Upload       │ 📜 View          │   │
│  │ Commits         │ Notes           │ History          │   │
│  └─────────────────┴─────────────────┴──────────────────┘   │
└────────────────────────────────────────────────────────────────┘
```

### Analyze Tab

- Clean form with date pickers
- Author email input
- Checkbox for task creation
- Gradient action button
- Results with stats cards
- Task list with icons and badges

### Notes Tab

- File upload area with drag & drop
- Large text area for pasting notes
- Auto task creation toggle
- Results display with extracted tasks
- Direct links to created ClickUp tasks

---

## 🎯 Default Assignee

**All tasks are automatically assigned to:**

- **Name**: Sri Gurusharanatmananda
- **Email**: zacchaeus.napuo@uskfoundation.or.ke

This is configured in the backend and cannot be changed from the UI (by design, for consistency).

---

## 🔧 Configuration

### Backend Configuration

Make sure your `.env` file includes:

```bash
# ClickUp Configuration
CLICKUP_TEAM_ID=your_team_id
CLICKUP_API_KEY=pk_your_api_key
CLICKUP_DEFAULT_LIST_ID=your_list_id

# Default Assignee (already set)
CLICKUP_DEFAULT_ASSIGNEE=zacchaeus.napuo@uskfoundation.or.ke

# Server Configuration
WEBHOOK_PORT=3000
```

### UI Configuration

The UI is pre-configured to:
- Run on port 3001
- Proxy API requests to localhost:3000
- Use purple/pink gradient theme

---

## 💻 Development

### UI Development

```bash
cd ui
npm run dev    # Start development server
npm run build  # Build for production
npm run lint   # Run ESLint
```

### Backend Development

```bash
npm run build    # Compile TypeScript
npm run webhook  # Start backend server
npm test         # Run tests
```

### Running Both Simultaneously

**Terminal 1 (Backend):**
```bash
npm run webhook
```

**Terminal 2 (UI):**
```bash
cd ui && npm run dev
```

Then open http://localhost:3001

---

## 🎨 Customization

### Colors

The UI uses a purple/pink gradient theme. To customize, edit:

**ui/tailwind.config.ts:**
```typescript
theme: {
  extend: {
    colors: {
      primary: {
        // Your custom colors here
      }
    }
  }
}
```

### Fonts

The UI uses Geist Sans and Geist Mono. To change, edit:

**ui/app/layout.tsx:**
```typescript
import { YourFont } from "next/font/google";
```

---

## 📊 API Endpoints

The UI communicates with these backend endpoints:

### POST /api/analyze
```json
{
  "date": "2025-01-22",
  "endDate": "2025-01-23",
  "author": "optional@email.com",
  "createTasks": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "workAnalysis": { ... },
    "createdTasks": [ ... ],
    "summary": {
      "totalCommits": 10,
      "totalWorkItems": 5,
      "totalFilesChanged": 15,
      "tasksCreated": 5
    }
  }
}
```

### POST /api/notes
```json
{
  "notes": "- Add authentication\n- Fix payment bug",
  "createTasks": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "processedNotes": {
      "totalTasks": 2,
      "tasks": [ ... ]
    },
    "createdTasks": [ ... ],
    "summary": {
      "tasksExtracted": 2,
      "tasksCreated": 2
    }
  }
}
```

---

## 🐛 Troubleshooting

### UI won't start
- Check if port 3001 is already in use
- Run `cd ui && npm install` to ensure dependencies are installed
- Check Node.js version (requires 18+)

### API requests failing
- Ensure backend server is running on port 3000
- Check backend logs for errors
- Verify ClickUp credentials in `.env`

### Tasks not being assigned
- Verify CLICKUP_DEFAULT_ASSIGNEE in `.env`
- Check that the email exists in your ClickUp workspace
- Review backend logs for assignment errors

### Styling issues
- Run `cd ui && npm run build` to regenerate Tailwind CSS
- Clear browser cache
- Check for console errors in browser dev tools

---

## 🚀 Production Deployment

### Build for Production

```bash
# Build backend
npm run build

# Build UI
cd ui
npm run build
```

### Run Production

```bash
# Start backend (Terminal 1)
npm run webhook

# Start UI (Terminal 2)
cd ui
npm start
```

### Environment Variables

Make sure all environment variables are set in production:

```bash
# .env
CLICKUP_TEAM_ID=...
CLICKUP_API_KEY=...
CLICKUP_DEFAULT_LIST_ID=...
CLICKUP_DEFAULT_ASSIGNEE=zacchaeus.napuo@uskfoundation.or.ke
WEBHOOK_PORT=3000
```

---

## 📝 Best Practices

### For Commit Analysis
1. Use specific date ranges for accurate analysis
2. Filter by author for team member reviews
3. Review detected work before creating tasks
4. Check task names and descriptions in ClickUp

### For Notes Upload
1. Use clear, actionable language
2. One task per line for better parsing
3. Include keywords (add, fix, improve) for correct classification
4. Review extracted tasks before creation

---

## 🎓 Tips & Tricks

### Keyboard Shortcuts
- Tab navigation works everywhere
- Enter submits forms
- Escape closes modals (when implemented)

### Notes Format Examples

**Good:**
```
- Add user authentication with OAuth
- Fix bug where payment fails on mobile
- Improve dashboard load performance by 50%
- TODO: Write API documentation
```

**Best:**
```
1. Implement OAuth authentication (Google + GitHub)
2. Fix: Payment gateway timeout on mobile devices
3. Optimize dashboard queries for faster loading
4. Document all REST API endpoints with examples
```

---

## 🆘 Support

### Documentation
- `IMPROVEMENTS.md` - All feature improvements
- `NOTES_FEATURE.md` - Notes feature details
- `ui/README.md` - UI-specific docs

### Common Issues
1. **Port conflicts**: Change ports in `ui/package.json` and `next.config.ts`
2. **CORS errors**: Check backend CORS configuration
3. **Build errors**: Delete `ui/.next` and `ui/node_modules`, then reinstall

---

## 🎉 You're All Set!

Your professional Auto Work Analyzer UI is ready to use!

**Start the servers:**
```bash
# Terminal 1
npm run webhook

# Terminal 2
cd ui && npm run dev
```

**Open your browser:**
http://localhost:3001

Enjoy your beautiful, intuitive task management interface! 🚀

---

**Last Updated:** 2025-10-22
**UI Version:** 1.0.0
**Built with:** Next.js 15 + TypeScript + Tailwind CSS
