'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { api, messageFor } from '@/lib/api';
import { copyToClipboard } from '@/lib/clipboard';
import type { EnhancedWorkItem } from '@/types';

export interface WorkItem {
  id: string;
  analysisId: string;
  name: string;
  type: string;
  description: string;
  estimatedHours: number;
  complexity: number;
  filesCount: number;
  commitsCount: number;
  createdAt: string;
}

export interface Analysis {
  id: string;
  timestamp: string;
  projectPath: string;
  date: string;
  endDate?: string;
  author?: string;
  branch?: string;
  totalCommits: number;
  totalWorkItems: number;
  tasksCreated: number;
  summary: string;
}

export interface SavedReport {
  analysis: Analysis;
  workItems: WorkItem[];
}

export interface EditableWorkItem extends WorkItem {
  selected: boolean;
  isEditing: boolean;
}

export function useReport(reportId: string) {
  const [report, setReport] = useState<SavedReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editableWorkItems, setEditableWorkItems] = useState<EditableWorkItem[]>([]);
  const [enhancingItems, setEnhancingItems] = useState<Set<string>>(new Set());
  const [managerSummary, setManagerSummary] = useState<string>('');
  const [isGeneratingManagerSummary, setIsGeneratingManagerSummary] = useState(false);

  // No token gate: every page using this hook renders under `ProtectedRoute`,
  // which is the one place that decides whether a session exists.
  useEffect(() => {
    void loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId]);

  const loadReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const loaded = await api.get<SavedReport>(`/reports/${reportId}`);
      setReport(loaded);
      setEditableWorkItems(
        loaded.workItems.map((item) => ({ ...item, selected: true, isEditing: false }))
      );
    } catch (caught) {
      const message = messageFor(caught, 'Failed to load report');
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const toggleEditMode = (id: string) => {
    setEditableWorkItems(items =>
      items.map(item =>
        item.id === id ? { ...item, isEditing: !item.isEditing } : item
      )
    );
  };

  const updateWorkItem = (id: string, field: 'name' | 'type' | 'description', value: string) => {
    setEditableWorkItems(items =>
      items.map(item =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  const handleEnhanceWithAI = async (id: string) => {
    const item = editableWorkItems.find(i => i.id === id);
    if (!item) return;

    setEnhancingItems(prev => new Set([...prev, id]));
    const toastId = toast.loading('✨ Enhancing with AI...');

    try {
      const enhanced = await api.post<EnhancedWorkItem>('/ai-enhance', {
        workItemName: item.name,
        description: item.description,
        commits: [],
        filesChanged: [],
      });

      setEditableWorkItems(items =>
        items.map(i =>
          i.id === id
            ? {
                ...i,
                name: enhanced.improvedTitle || i.name,
                description: enhanced.description,
                isEditing: true,
              }
            : i
        )
      );

      toast.success('✨ Enhanced with AI! (Title and description updated)', { id: toastId, duration: 3000 });
    } catch (caught) {
      toast.error(`❌ ${messageFor(caught, 'Failed to enhance with AI')}`, { id: toastId, duration: 5000 });
    } finally {
      setEnhancingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  };

  const generateSummaryReport = () => {
    const lines = ['Sri Gurusharanatmanda EOD:'];
    editableWorkItems.forEach(work => {
      const emoji = work.type === 'feature' ? '✨' : work.type === 'bug-fix' ? '🐛' : '🔧';
      lines.push(`- ${emoji} ${work.name}`);
    });
    return lines.join('\n');
  };

  const generateDetailedReport = () => {
    const lines = ['Sri Gurusharanatmanda EOD:'];
    editableWorkItems.forEach(work => {
      const emoji = work.type === 'feature' ? '✨' : work.type === 'bug-fix' ? '🐛' : '🔧';
      lines.push(`- ${emoji} ${work.name}`);
      if (work.description && work.description.trim()) {
        const descLines = work.description.split('\n').filter(line => line.trim());
        descLines.forEach(line => {
          lines.push(`  ${line.trim()}`);
        });
      }
    });
    return lines.join('\n');
  };

  const handleCopySummary = () => copyToClipboard(generateSummaryReport(), 'Summary');

  const handleCopyDetailed = () => copyToClipboard(generateDetailedReport(), 'Detailed report');

  const generateManagerSummary = async () => {
    setIsGeneratingManagerSummary(true);
    const toastId = toast.loading('🤖 Generating manager-friendly summary...');

    try {
      const generated = await api.post<{ summary: string }>('/manager-summary', {
        workItems: editableWorkItems,
        reportDate: report?.analysis.date,
      });

      setManagerSummary(generated.summary);
      toast.success('✨ Manager summary generated!', { id: toastId, duration: 3000 });
    } catch (caught) {
      toast.error(`❌ ${messageFor(caught, 'Failed to generate manager summary')}`, {
        id: toastId,
        duration: 5000,
      });
    } finally {
      setIsGeneratingManagerSummary(false);
    }
  };

  const handleCopyManagerSummary = () => {
    if (!managerSummary) {
      toast.error('Please generate the manager summary first');
      return Promise.resolve();
    }
    return copyToClipboard(managerSummary, 'Manager summary');
  };

  return {
    report,
    loading,
    error,
    editableWorkItems,
    enhancingItems,
    managerSummary,
    isGeneratingManagerSummary,
    toggleEditMode,
    updateWorkItem,
    handleEnhanceWithAI,
    generateSummaryReport,
    generateDetailedReport,
    generateManagerSummary,
    handleCopySummary,
    handleCopyDetailed,
    handleCopyManagerSummary,
    reload: loadReport,
  };
}
