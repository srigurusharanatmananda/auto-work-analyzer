'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '@/lib/context/AuthContext';

const BACKEND_URL = 'http://localhost:3009';

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
  const { accessToken } = useAuth();
  const [report, setReport] = useState<SavedReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editableWorkItems, setEditableWorkItems] = useState<EditableWorkItem[]>([]);
  const [enhancingItems, setEnhancingItems] = useState<Set<string>>(new Set());
  const [managerSummary, setManagerSummary] = useState<string>('');
  const [isGeneratingManagerSummary, setIsGeneratingManagerSummary] = useState(false);

  useEffect(() => {
    if (accessToken) {
      loadReport();
    }
  }, [reportId, accessToken]);

  const loadReport = async () => {
    if (!accessToken) {
      setError('Not authenticated');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${BACKEND_URL}/api/reports/${reportId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        credentials: 'include',
      });
      const result = await response.json();

      if (result.success && result.data) {
        setReport(result.data);
        const items: EditableWorkItem[] = result.data.workItems.map((item: WorkItem) => ({
          ...item,
          selected: true,
          isEditing: false,
        }));
        setEditableWorkItems(items);
      } else {
        setError(result.error || 'Failed to load report');
        toast.error(`Failed to load report: ${result.error}`);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to connect to backend server';
      setError(errorMsg);
      toast.error('Failed to load report - backend server may not be running');
      console.error(err);
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

    if (!accessToken) {
      toast.error('Not authenticated');
      return;
    }

    setEnhancingItems(prev => new Set([...prev, id]));
    const toastId = toast.loading('✨ Enhancing with AI...');

    try {
      const response = await fetch(`${BACKEND_URL}/api/ai-enhance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        credentials: 'include',
        body: JSON.stringify({
          workItemName: item.name,
          description: item.description,
          commits: [],
          filesChanged: [],
        }),
      });

      const result = await response.json();

      if (result.success) {
        const enhanced = result.data;

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
      } else {
        toast.error(`❌ ${result.error || 'Failed to enhance with AI'}`, { id: toastId, duration: 5000 });
      }
    } catch (err) {
      toast.error(`❌ ${err instanceof Error ? err.message : 'An error occurred'}`, { id: toastId, duration: 5000 });
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

  const handleCopySummary = async () => {
    const reportText = generateSummaryReport();
    try {
      await navigator.clipboard.writeText(reportText);
      toast.success('📋 Summary copied to clipboard!', { duration: 2000 });
    } catch (err) {
      toast.error('Failed to copy summary');
    }
  };

  const handleCopyDetailed = async () => {
    const reportText = generateDetailedReport();
    try {
      await navigator.clipboard.writeText(reportText);
      toast.success('📋 Detailed report copied to clipboard!', { duration: 2000 });
    } catch (err) {
      toast.error('Failed to copy report');
    }
  };

  const generateManagerSummary = async () => {
    if (!accessToken) {
      toast.error('Not authenticated');
      return;
    }

    setIsGeneratingManagerSummary(true);
    const toastId = toast.loading('🤖 Generating manager-friendly summary...');

    try {
      const response = await fetch(`${BACKEND_URL}/api/manager-summary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        credentials: 'include',
        body: JSON.stringify({
          workItems: editableWorkItems,
          reportDate: report?.analysis.date,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setManagerSummary(result.data.summary);
        toast.success('✨ Manager summary generated!', { id: toastId, duration: 3000 });
      } else {
        toast.error(`❌ ${result.error || 'Failed to generate manager summary'}`, { id: toastId, duration: 5000 });
      }
    } catch (err) {
      toast.error(`❌ ${err instanceof Error ? err.message : 'An error occurred'}`, { id: toastId, duration: 5000 });
    } finally {
      setIsGeneratingManagerSummary(false);
    }
  };

  const handleCopyManagerSummary = async () => {
    if (!managerSummary) {
      toast.error('Please generate the manager summary first');
      return;
    }

    try {
      await navigator.clipboard.writeText(managerSummary);
      toast.success('📋 Manager summary copied to clipboard!', { duration: 2000 });
    } catch (err) {
      toast.error('Failed to copy manager summary');
    }
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
