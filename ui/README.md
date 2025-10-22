# Auto Work Analyzer - Web UI

This is the web interface for the Auto Work Analyzer, built with Next.js 15, TypeScript, and Tailwind CSS.

## Features

- **Analyze Git Commits**: Analyze your git commits visually through a web interface
- **Upload Notes**: Upload or paste notes and convert them to ClickUp tasks
- **View History**: (Coming soon) View your analysis history
- **Auto-Assign**: All tasks are automatically assigned to Sri Gurusharanatmananda (zacchaeus.napuo@uskfoundation.or.ke)

## Getting Started

### Prerequisites

- Node.js 18+ installed
- Backend server running on port 3000

### Installation

```bash
# Install dependencies
npm install
```

### Running the UI

```bash
# Development mode (http://localhost:3001)
npm run dev

# Production build
npm run build
npm start
```

## Architecture

- **Next.js 15**: App Router with Server Components
- **TypeScript**: Full type safety
- **Tailwind CSS**: Utility-first styling
- **API Proxy**: Requests to `/api/*` are proxied to the backend server on port 3000

## Project Structure

```
ui/
├── app/
│   ├── layout.tsx        # Root layout
│   ├── page.tsx          # Main page with tabs
│   └── globals.css       # Global styles
├── components/
│   ├── AnalyzeTab.tsx    # Commit analysis tab
│   ├── NotesTab.tsx      # Notes upload tab
│   ├── HistoryTab.tsx    # History tab
│   └── ResultsDisplay.tsx # Results component
├── types/
│   └── index.ts          # TypeScript types
└── package.json
```

## API Integration

The UI communicates with the backend via these endpoints:

- `POST /api/analyze` - Analyze git commits
- `POST /api/notes` - Process notes and create tasks

All requests are automatically proxied to `http://localhost:3000` via Next.js rewrites.

## Styling

This project uses Tailwind CSS with a custom purple/pink gradient theme that matches the branding.

## Development

The UI runs on port 3001 by default to avoid conflicts with the backend API server (port 3000).

To develop:

1. Start the backend server: `npm run webhook` (from root directory)
2. Start the UI: `cd ui && npm run dev`
3. Open http://localhost:3001

## License

Part of the Auto Work Analyzer project.
