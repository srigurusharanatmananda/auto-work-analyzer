export interface DetectedWork {
  type: 'feature' | 'bug-fix' | 'improvement' | 'refactor' | 'documentation' | 'test';
  name: string;
  description: string;
  files: string[];
  commits?: any[];
  complexity: 'low' | 'medium' | 'high';
  estimatedHours: number;
  tags: string[];
}

export interface WorkAnalysisResult {
  date: string;
  totalCommits: number;
  totalFilesChanged: number;
  totalLinesAdded: number;
  totalLinesDeleted: number;
  detectedWork: DetectedWork[];
  summary: string;
}

export interface AnalysisResponse {
  workAnalysis: WorkAnalysisResult;
  createdTasks: CreatedTask[];
  summary: {
    date: string;
    totalCommits: number;
    totalWorkItems: number;
    totalFilesChanged: number;
    totalLinesChanged: number;
    tasksCreated: number;
  };
}

export interface NotesTask {
  name: string;
  type: string;
  complexity: string;
  estimatedHours: number;
  tags: string[];
}

export interface ProcessedNotes {
  totalTasks: number;
  tasks: NotesTask[];
}

export interface CreatedTask {
  id: string;
  name: string;
  url: string;
}

export interface NotesResponse {
  processedNotes: ProcessedNotes;
  createdTasks: CreatedTask[];
  summary: {
    tasksExtracted: number;
    tasksCreated: number;
  };
}
