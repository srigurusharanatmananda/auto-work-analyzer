'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import AnalyzeTab from '@/components/AnalyzeTab';
import NotesTab from '@/components/NotesTab';
import HistoryTab from '@/components/HistoryTab';
import ReportsTab from '@/components/ReportsTab';
import SavedReportsTab from '@/components/SavedReportsTab';

type Tab = 'analyze' | 'notes' | 'history' | 'reports' | 'saved';

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('analyze');
  const [selectedProjectPath, setSelectedProjectPath] = useState<string>('');

  // Show welcome toast on first load
  useEffect(() => {
    const hasSeenWelcome = sessionStorage.getItem('welcomeToastShown');
    if (!hasSeenWelcome) {
      setTimeout(() => {
        toast.success('👋 Welcome! All tasks will be assigned to Sri Gurusharanatmananda', {
          duration: 5000,
        });
        sessionStorage.setItem('welcomeToastShown', 'true');
      }, 1000);
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-3 drop-shadow-lg">
            🚀 Auto Work Analyzer
          </h1>
          <p className="text-xl text-white/90 drop-shadow">
            Intelligent Git Commit Analysis & Task Management
          </p>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {/* Assignee Info */}
          <div className="bg-blue-100 border-2 border-blue-300 rounded-xl p-4 flex items-center gap-3 shadow-md">
            <span className="text-2xl">📧</span>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">Default Assignee</div>
              <div className="text-sm text-gray-800 font-medium truncate">
                Sri Gurusharanatmananda
              </div>
            </div>
          </div>

          {/* Selected Project Info */}
          <div className={`border-2 rounded-xl p-4 flex items-center gap-3 shadow-md ${
            selectedProjectPath
              ? 'bg-green-100 border-green-300'
              : 'bg-gray-100 border-gray-300'
          }`}>
            <span className="text-2xl">📁</span>
            <div className="flex-1 min-w-0">
              <div className={`text-xs font-semibold uppercase tracking-wide mb-1 ${
                selectedProjectPath ? 'text-green-600' : 'text-gray-600'
              }`}>
                Selected Project
              </div>
              {selectedProjectPath ? (
                <code className="text-sm bg-white px-2 py-1 rounded font-medium text-gray-800 block truncate">
                  {selectedProjectPath}
                </code>
              ) : (
                <div className="text-sm text-gray-500 italic">
                  No project selected - use Browse button in any tab
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 mb-8 shadow-xl">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <button
              onClick={() => setActiveTab('analyze')}
              className={`py-4 px-6 rounded-xl font-semibold transition-all duration-300 ${
                activeTab === 'analyze'
                  ? 'bg-white text-purple-600 shadow-lg transform scale-105'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              📊 Analyze Commits
            </button>
            <button
              onClick={() => setActiveTab('notes')}
              className={`py-4 px-6 rounded-xl font-semibold transition-all duration-300 ${
                activeTab === 'notes'
                  ? 'bg-white text-purple-600 shadow-lg transform scale-105'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              📝 Upload Notes
            </button>
            <button
              onClick={() => setActiveTab('reports')}
              className={`py-4 px-6 rounded-xl font-semibold transition-all duration-300 ${
                activeTab === 'reports'
                  ? 'bg-white text-purple-600 shadow-lg transform scale-105'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              📄 Daily Reports
            </button>
            <button
              onClick={() => setActiveTab('saved')}
              className={`py-4 px-6 rounded-xl font-semibold transition-all duration-300 ${
                activeTab === 'saved'
                  ? 'bg-white text-purple-600 shadow-lg transform scale-105'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              💾 Saved Reports
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`py-4 px-6 rounded-xl font-semibold transition-all duration-300 ${
                activeTab === 'history'
                  ? 'bg-white text-purple-600 shadow-lg transform scale-105'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              📜 View History
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="transition-opacity duration-300">
          {activeTab === 'analyze' && (
            <AnalyzeTab
              selectedProjectPath={selectedProjectPath}
              setSelectedProjectPath={setSelectedProjectPath}
            />
          )}
          {activeTab === 'notes' && <NotesTab />}
          {activeTab === 'reports' && (
            <ReportsTab
              selectedProjectPath={selectedProjectPath}
              setSelectedProjectPath={setSelectedProjectPath}
            />
          )}
          {activeTab === 'saved' && <SavedReportsTab />}
          {activeTab === 'history' && <HistoryTab />}
        </div>
      </div>
    </div>
  );
}
