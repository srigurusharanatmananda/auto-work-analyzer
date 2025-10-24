'use client';

import { AnalysisResponse, NotesResponse, DetectedWork } from '@/types';
import Card from '@/lib/components/ui/Card';

interface ResultsDisplayProps {
  type: 'analysis' | 'notes';
  data: AnalysisResponse | NotesResponse;
}

export default function ResultsDisplay({ type, data }: ResultsDisplayProps) {
  const getWorkIcon = (workType: string) => {
    const icons: Record<string, string> = {
      feature: '✨',
      'bug-fix': '🐛',
      improvement: '🔧',
      test: '🧪',
      documentation: '📝',
      refactor: '♻️',
    };
    return icons[workType] || '📌';
  };

  const getWorkBadgeColor = (workType: string) => {
    const colors: Record<string, string> = {
      feature: 'bg-blue-500/10 text-blue-400',
      'bug-fix': 'bg-red-500/10 text-red-400',
      improvement: 'bg-primary/10 text-primary',
      test: 'bg-success/10 text-success',
      documentation: 'bg-orange-500/10 text-orange-400',
      refactor: 'bg-indigo-500/10 text-indigo-400',
    };
    return colors[workType] || 'bg-foreground-tertiary/10 text-foreground-secondary';
  };

  const renderTaskItem = (work: DetectedWork) => (
    <Card
      key={work.name}
      hover
      className="p-5"
    >
      <div className="flex items-start gap-4">
        <span className="text-3xl">{getWorkIcon(work.type)}</span>
        <div className="flex-1">
          <h4 className="font-semibold text-lg text-foreground mb-2">{work.name}</h4>
          <div className="flex flex-wrap gap-2 text-sm">
            <span className={`px-3 py-1 rounded-full font-medium ${getWorkBadgeColor(work.type)}`}>
              {work.type}
            </span>
            {'files' in work && work.files && (
              <span className="px-3 py-1 rounded-full bg-foreground-tertiary/10 text-foreground-secondary">
                📁 {work.files.length} files
              </span>
            )}
            <span className="px-3 py-1 rounded-full bg-foreground-tertiary/10 text-foreground-secondary">
              ⏱️ {work.estimatedHours}h
            </span>
            <span className="px-3 py-1 rounded-full bg-foreground-tertiary/10 text-foreground-secondary">
              📊 {work.complexity}
            </span>
            {work.tags.map((tag) => (
              <span key={tag} className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );

  if (type === 'analysis') {
    const analysisData = data as AnalysisResponse;
    const { workAnalysis, createdTasks, summary } = analysisData;

    return (
      <div className="mt-8 space-y-6">
        {/* Success Alert */}
        <div className="bg-success/10 border-l-4 border-success p-4 rounded-r-xl">
          <div className="flex items-center gap-2">
            <span className="text-2xl">✅</span>
            <p className="text-success font-medium">Analysis completed successfully!</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-5 text-center bg-gradient-to-br from-primary/20 to-primary/5 border-primary/20">
            <h3 className="text-4xl font-bold mb-1 text-foreground">{summary.totalCommits}</h3>
            <p className="text-foreground-secondary text-sm">Total Commits</p>
          </Card>
          <Card className="p-5 text-center bg-gradient-to-br from-blue-500/20 to-blue-500/5 border-blue-500/20">
            <h3 className="text-4xl font-bold mb-1 text-foreground">{summary.totalWorkItems}</h3>
            <p className="text-foreground-secondary text-sm">Work Items</p>
          </Card>
          <Card className="p-5 text-center bg-gradient-to-br from-success/20 to-success/5 border-success/20">
            <h3 className="text-4xl font-bold mb-1 text-foreground">{summary.totalFilesChanged}</h3>
            <p className="text-foreground-secondary text-sm">Files Changed</p>
          </Card>
          <Card className="p-5 text-center bg-gradient-to-br from-orange-500/20 to-orange-500/5 border-orange-500/20">
            <h3 className="text-4xl font-bold mb-1 text-foreground">{summary.tasksCreated}</h3>
            <p className="text-foreground-secondary text-sm">Tasks Created</p>
          </Card>
        </div>

        {/* Work Items */}
        <div>
          <h3 className="text-2xl font-bold text-foreground mb-4">Detected Work Items</h3>
          <div className="space-y-3">
            {workAnalysis.detectedWork.map(renderTaskItem)}
          </div>
        </div>

        {/* Created Tasks */}
        {createdTasks && createdTasks.length > 0 && (
          <Card className="bg-success/10 border-2 border-success/30">
            <h3 className="text-xl font-bold text-success mb-2 flex items-center gap-2">
              <span>✅</span>
              <span>Tasks Created in ClickUp</span>
            </h3>
            <p className="text-success/90 mb-4">
              {createdTasks.length} tasks were successfully created and assigned to Sri Gurusharanatmananda
            </p>
          </Card>
        )}
      </div>
    );
  } else {
    const notesData = data as NotesResponse;
    const { processedNotes, createdTasks, summary } = notesData;

    return (
      <div className="mt-8 space-y-6">
        {/* Success Alert */}
        <div className="bg-success/10 border-l-4 border-success p-4 rounded-r-xl">
          <div className="flex items-center gap-2">
            <span className="text-2xl">✅</span>
            <p className="text-success font-medium">Notes processed successfully!</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-6 text-center bg-gradient-to-br from-primary/20 to-primary/5 border-primary/20">
            <h3 className="text-5xl font-bold mb-2 text-foreground">{summary.tasksExtracted}</h3>
            <p className="text-foreground-secondary">Tasks Extracted</p>
          </Card>
          <Card className="p-6 text-center bg-gradient-to-br from-success/20 to-success/5 border-success/20">
            <h3 className="text-5xl font-bold mb-2 text-foreground">{summary.tasksCreated}</h3>
            <p className="text-foreground-secondary">Tasks Created</p>
          </Card>
        </div>

        {/* Extracted Tasks */}
        <div>
          <h3 className="text-2xl font-bold text-foreground mb-4">Extracted Tasks</h3>
          <div className="space-y-3">
            {processedNotes.tasks.map((task) => renderTaskItem(task as DetectedWork))}
          </div>
        </div>

        {/* Created Tasks with Links */}
        {createdTasks && createdTasks.length > 0 && (
          <Card className="bg-success/10 border-2 border-success/30">
            <h3 className="text-xl font-bold text-success mb-2 flex items-center gap-2">
              <span>✅</span>
              <span>Tasks Created in ClickUp</span>
            </h3>
            <p className="text-success/90 mb-4">
              {createdTasks.length} tasks were successfully created and assigned to Sri Gurusharanatmananda
            </p>
            <div className="space-y-2">
              {createdTasks.map((task) => (
                <div key={task.id} className="bg-background-secondary p-3 rounded-lg border border-border">
                  <a
                    href={task.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:text-primary-hover font-semibold flex items-center gap-2"
                  >
                    <span>🔗</span>
                    <span>{task.name}</span>
                  </a>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    );
  }
}
