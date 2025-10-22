'use client';

import { AnalysisResponse, NotesResponse, DetectedWork } from '@/types';

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
      feature: 'bg-blue-100 text-blue-700',
      'bug-fix': 'bg-red-100 text-red-700',
      improvement: 'bg-purple-100 text-purple-700',
      test: 'bg-green-100 text-green-700',
      documentation: 'bg-orange-100 text-orange-700',
      refactor: 'bg-indigo-100 text-indigo-700',
    };
    return colors[workType] || 'bg-gray-100 text-gray-700';
  };

  const renderTaskItem = (work: DetectedWork) => (
    <div
      key={work.name}
      className="bg-gray-50 border-2 border-gray-200 rounded-xl p-5 hover:border-purple-300 hover:shadow-md transition-all duration-300"
    >
      <div className="flex items-start gap-4">
        <span className="text-3xl">{getWorkIcon(work.type)}</span>
        <div className="flex-1">
          <h4 className="font-semibold text-lg text-gray-800 mb-2">{work.name}</h4>
          <div className="flex flex-wrap gap-2 text-sm">
            <span className={`px-3 py-1 rounded-full font-medium ${getWorkBadgeColor(work.type)}`}>
              {work.type}
            </span>
            {'files' in work && work.files && (
              <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-700">
                📁 {work.files.length} files
              </span>
            )}
            <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-700">
              ⏱️ {work.estimatedHours}h
            </span>
            <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-700">
              📊 {work.complexity}
            </span>
            {work.tags.map((tag) => (
              <span key={tag} className="px-3 py-1 rounded-full bg-purple-100 text-purple-700 text-xs">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  if (type === 'analysis') {
    const analysisData = data as AnalysisResponse;
    const { workAnalysis, createdTasks, summary } = analysisData;

    return (
      <div className="mt-8 space-y-6">
        {/* Success Alert */}
        <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-r-xl">
          <div className="flex items-center gap-2">
            <span className="text-2xl">✅</span>
            <p className="text-green-700 font-medium">Analysis completed successfully!</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-purple-500 to-pink-500 text-white rounded-xl p-5 text-center shadow-lg">
            <h3 className="text-4xl font-bold mb-1">{summary.totalCommits}</h3>
            <p className="text-purple-100 text-sm">Total Commits</p>
          </div>
          <div className="bg-gradient-to-br from-blue-500 to-cyan-500 text-white rounded-xl p-5 text-center shadow-lg">
            <h3 className="text-4xl font-bold mb-1">{summary.totalWorkItems}</h3>
            <p className="text-blue-100 text-sm">Work Items</p>
          </div>
          <div className="bg-gradient-to-br from-green-500 to-emerald-500 text-white rounded-xl p-5 text-center shadow-lg">
            <h3 className="text-4xl font-bold mb-1">{summary.totalFilesChanged}</h3>
            <p className="text-green-100 text-sm">Files Changed</p>
          </div>
          <div className="bg-gradient-to-br from-orange-500 to-red-500 text-white rounded-xl p-5 text-center shadow-lg">
            <h3 className="text-4xl font-bold mb-1">{summary.tasksCreated}</h3>
            <p className="text-orange-100 text-sm">Tasks Created</p>
          </div>
        </div>

        {/* Work Items */}
        <div>
          <h3 className="text-2xl font-bold text-gray-800 mb-4">Detected Work Items</h3>
          <div className="space-y-3">
            {workAnalysis.detectedWork.map(renderTaskItem)}
          </div>
        </div>

        {/* Created Tasks */}
        {createdTasks && createdTasks.length > 0 && (
          <div className="bg-green-50 border-2 border-green-200 rounded-xl p-6">
            <h3 className="text-xl font-bold text-green-800 mb-2 flex items-center gap-2">
              <span>✅</span>
              <span>Tasks Created in ClickUp</span>
            </h3>
            <p className="text-green-700 mb-4">
              {createdTasks.length} tasks were successfully created and assigned to Sri Gurusharanatmananda
            </p>
          </div>
        )}
      </div>
    );
  } else {
    const notesData = data as NotesResponse;
    const { processedNotes, createdTasks, summary } = notesData;

    return (
      <div className="mt-8 space-y-6">
        {/* Success Alert */}
        <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-r-xl">
          <div className="flex items-center gap-2">
            <span className="text-2xl">✅</span>
            <p className="text-green-700 font-medium">Notes processed successfully!</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gradient-to-br from-purple-500 to-pink-500 text-white rounded-xl p-6 text-center shadow-lg">
            <h3 className="text-5xl font-bold mb-2">{summary.tasksExtracted}</h3>
            <p className="text-purple-100">Tasks Extracted</p>
          </div>
          <div className="bg-gradient-to-br from-green-500 to-emerald-500 text-white rounded-xl p-6 text-center shadow-lg">
            <h3 className="text-5xl font-bold mb-2">{summary.tasksCreated}</h3>
            <p className="text-green-100">Tasks Created</p>
          </div>
        </div>

        {/* Extracted Tasks */}
        <div>
          <h3 className="text-2xl font-bold text-gray-800 mb-4">Extracted Tasks</h3>
          <div className="space-y-3">
            {processedNotes.tasks.map((task) => renderTaskItem(task as DetectedWork))}
          </div>
        </div>

        {/* Created Tasks with Links */}
        {createdTasks && createdTasks.length > 0 && (
          <div className="bg-green-50 border-2 border-green-200 rounded-xl p-6">
            <h3 className="text-xl font-bold text-green-800 mb-2 flex items-center gap-2">
              <span>✅</span>
              <span>Tasks Created in ClickUp</span>
            </h3>
            <p className="text-green-700 mb-4">
              {createdTasks.length} tasks were successfully created and assigned to Sri Gurusharanatmananda
            </p>
            <div className="space-y-2">
              {createdTasks.map((task) => (
                <div key={task.id} className="bg-white p-3 rounded-lg border border-green-300">
                  <a
                    href={task.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-600 hover:text-purple-800 font-semibold flex items-center gap-2"
                  >
                    <span>🔗</span>
                    <span>{task.name}</span>
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }
}
