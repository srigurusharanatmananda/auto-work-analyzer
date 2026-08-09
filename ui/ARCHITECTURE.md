# Auto Work Analyzer - Frontend Architecture

## Overview

The frontend has been completely restructured into a professional, scalable Next.js 15 application following modern best practices and featuring a minimalistic dark theme inspired by Google AI Studio.

## Tech Stack

- **Next.js 15** - App Router with React Server Components
- **TypeScript** - Full type safety
- **Tailwind CSS** - Utility-first CSS framework
- **React Hot Toast** - Toast notifications
- **clsx + tailwind-merge** - Conditional styling utilities

## Project Structure

```
ui/
├── app/                          # Next.js App Router
│   ├── layout.tsx               # Root layout with sidebar
│   ├── page.tsx                 # Dashboard (/)
│   ├── loading.tsx              # Global loading state
│   ├── error.tsx                # Global error boundary
│   ├── not-found.tsx            # 404 page
│   ├── globals.css              # Global styles & dark theme
│   ├── analyze/                 # /analyze route
│   ├── reports/                 # /reports route
│   ├── saved-reports/           # /saved-reports route
│   ├── notes/                   # /notes route
│   ├── history/                 # /history route
│   └── settings/                # /settings route
│
├── lib/                          # Shared library code
│   ├── components/              # Reusable components
│   │   ├── ui/                  # UI component library
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── LoadingSpinner.tsx
│   │   │   ├── EmptyState.tsx
│   │   │   └── index.ts
│   │   ├── Sidebar.tsx          # Main navigation sidebar
│   │   └── ErrorBoundary.tsx    # Error boundary component
│   │
│   ├── hooks/                   # Custom React hooks (to be added)
│   ├── utils.ts                 # Utility functions
│   └── types.ts                 # Shared TypeScript types
│
├── components/                   # Legacy components (to be migrated)
│   ├── AnalyzeTab.tsx
│   ├── ReportsTab.tsx
│   ├── SavedReportsTab.tsx
│   ├── NotesTab.tsx
│   └── HistoryTab.tsx
│
├── types/                        # Type definitions
│   └── index.ts
│
├── tailwind.config.ts           # Tailwind configuration
├── tsconfig.json                # TypeScript configuration
└── package.json                 # Dependencies

```

## Design System

### Dark Theme Colors

```typescript
background: {
  DEFAULT: "#0a0a0a",    // Main background
  secondary: "#1a1a1a",  // Cards, sidebar
  tertiary: "#2a2a2a",   // Hover states
}

foreground: {
  DEFAULT: "#ffffff",    // Primary text
  secondary: "#b3b3b3",  // Secondary text
  tertiary: "#737373",   // Tertiary text
}

border: {
  DEFAULT: "#2a2a2a",    // Default borders
  hover: "#3a3a3a",      // Hover borders
}

primary: "#3b82f6"       // Blue
secondary: "#8b5cf6"     // Purple
success: "#10b981"       // Green
warning: "#f59e0b"       // Orange
error: "#ef4444"         // Red
```

### Component Library

All UI components are built with:
- Dark theme support
- Consistent styling
- Accessibility features
- TypeScript types
- Hover states and transitions

#### Available Components

1. **Button** - Multiple variants (primary, secondary, ghost, danger)
2. **Card** - Container with optional hover effect
3. **Input** - Form input with label and error states
4. **Modal** - Overlay modal with backdrop
5. **LoadingSpinner** - Animated loading indicator
6. **EmptyState** - Empty state placeholder with icon

### Usage Example

```typescript
import { Button, Card, Input } from '@/lib/components/ui';

<Card hover className="p-6">
  <Input label="Email" placeholder="Enter your email" />
  <Button variant="primary" size="md">
    Submit
  </Button>
</Card>
```

## Key Features

### 1. App Router Structure
- File-based routing with Next.js 15 App Router
- Automatic code splitting
- Built-in loading and error states
- Nested layouts support

### 2. Error Handling
- Global error boundary (`app/error.tsx`)
- 404 page (`app/not-found.tsx`)
- Component-level error boundaries (`ErrorBoundary.tsx`)
- Toast notifications for user feedback

### 3. Loading States
- Global loading page (`app/loading.tsx`)
- Route-level loading states (Suspense boundaries)
- Component-level spinners

### 4. Navigation
- Sidebar navigation with active state indicators
- Responsive design
- Clean, minimalistic UI
- Persistent across routes

### 5. Type Safety
- Full TypeScript coverage
- Strict type checking enabled
- Path aliases (`@/...`) for clean imports
- Shared type definitions

## Migration Guide

### Converting Legacy Tabs to Routes

The old tab-based interface is being migrated to individual routes:

**Old Structure:**
```typescript
// All in one page with tabs
<TabButton onClick={() => setActiveTab('analyze')} />
{activeTab === 'analyze' && <AnalyzeTab />}
```

**New Structure:**
```typescript
// Separate route files
app/analyze/page.tsx - Analyze page
app/reports/page.tsx - Reports page
app/saved-reports/page.tsx - Saved reports page
```

### Steps to Migrate a Component

1. **Create the route directory:**
   ```bash
   mkdir ui/app/analyze
   ```

2. **Create `page.tsx`:**
   ```typescript
   'use client'; // If using client hooks

   import { ComponentName } from '@/components/ComponentName';

   export default function AnalyzePage() {
     return (
       <div className="p-8">
         {/* Component content */}
       </div>
     );
   }
   ```

3. **Add `loading.tsx` (optional):**
   ```typescript
   import { LoadingSpinner } from '@/lib/components/ui';

   export default function Loading() {
     return (
       <div className="flex min-h-[400px] items-center justify-center">
         <LoadingSpinner size="lg" />
       </div>
     );
   }
   ```

4. **Add `error.tsx` (optional):**
   ```typescript
   'use client';

   export default function Error({ error, reset }) {
     return (
       <div className="p-8">
         <h2>Something went wrong!</h2>
         <button onClick={reset}>Try again</button>
       </div>
     );
   }
   ```

## Best Practices

### 1. Component Organization
- Keep components small and focused
- Use the UI component library for consistency
- Create custom hooks for shared logic
- Use TypeScript for all components

### 2. Styling
- Use Tailwind utility classes
- Follow the design system colors
- Use `cn()` utility for conditional classes
- Keep dark theme in mind

### 3. State Management
- Use React hooks for local state
- Consider adding Zustand/Jotai for global state
- Keep server/client boundaries clear
- Use Server Components where possible

### 4. Performance
- Leverage React Server Components
- Use dynamic imports for heavy components
- Implement proper loading states
- Optimize images with Next.js Image component

### 5. Error Handling
- Always wrap risky operations in try-catch
- Provide meaningful error messages
- Use error boundaries for component errors
- Toast notifications for user feedback

## Next Steps

### To Complete the Migration:

1. **Create remaining route pages:**
   - `/analyze` - Move AnalyzeTab.tsx content
   - `/reports` - Move ReportsTab.tsx content
   - `/saved-reports` - Already has SavedReportsTab.tsx
   - `/notes` - Move NotesTab.tsx content
   - `/history` - Move HistoryTab.tsx content

2. **Add API route handlers:**
   ```typescript
   // app/api/analyze/route.ts
   export async function POST(request: Request) {
     // Handle API logic
   }
   ```

3. **Implement proper data fetching:**
   - Use React Server Components for initial data
   - Use SWR or React Query for client-side fetching
   - Implement proper caching strategies

4. **Add more features:**
   - Search functionality
   - Filtering and sorting
   - Pagination components
   - Export functionality
   - Settings page

5. **Testing:**
   - Add unit tests (Jest + Testing Library)
   - Add E2E tests (Playwright)
   - Test error boundaries
   - Test loading states

6. **Documentation:**
   - Add JSDoc comments to functions
   - Create component documentation
   - Add usage examples
   - Create API documentation

## Development Commands

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linting
npm run lint
```

## Talking to the API

**Everything goes through `lib/api`. Components do not call `fetch`.**

```ts
import { api, ApiError, messageFor } from '@/lib/api';

const preview = await api.post<PreviewPayload>('/preview-tasks', { transcript });
```

`ApiClient` owns the base URL, the `Authorization` header, `credentials`, and
unwrapping the `{ success, data, error }` envelope — so `api.get<T>()` resolves
to the payload and throws `ApiError` otherwise. Paths are written without the
`/api` prefix; the client adds it.

Three behaviours are worth knowing because no call site has to implement them:

- **Expired sessions recover.** A 401 refreshes the access token and retries the
  request once. Concurrent 401s share a single refresh — the backend rotates
  refresh tokens and treats reuse as theft, so a second parallel refresh would
  revoke the whole token family and log the user out.
- **A dead backend says so**, rather than surfacing `TypeError: Failed to fetch`.
- **Validation `details` survive** on `ApiError.details`, so a form can name the
  field the server rejected.

For a resource loaded on mount, use `useApiQuery` (`lib/api/useApiQuery`) instead
of hand-rolling data/loading/error state. Mutations stay explicit `api.post(...)`
calls in their handlers.

Readiness is `ProtectedRoute`'s job, not each component's: it does not render
children until a session exists, so components must not re-check for a token
before fetching.

## Environment Variables

All optional — see `.env.example`. Copy it to `.env.local` to change anything.

```bash
# Origin only: no /api suffix, no trailing slash. Defaults to localhost:3009.
NEXT_PUBLIC_API_URL=http://localhost:3009
```

`NEXT_PUBLIC_*` values are inlined at **build** time, so changing this requires a
rebuild — a built image cannot be re-pointed via its environment.

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Contributing

When adding new features:

1. Follow the established folder structure
2. Use the UI component library
3. Maintain the dark theme aesthetic
4. Add proper TypeScript types
5. Include loading and error states
6. Test on different screen sizes
7. Update this documentation

---

**Built with** ❤️ **using Next.js 15 and Tailwind CSS**
