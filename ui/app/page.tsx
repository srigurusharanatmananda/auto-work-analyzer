'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import AnalyzeTab from '@/components/AnalyzeTab';
import NotesTab from '@/components/NotesTab';
import HistoryTab from '@/components/HistoryTab';

type Tab = 'analyze' | 'notes' | 'history';

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('analyze');

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

        {/* Assignee Info */}
        <div className="bg-blue-100 border border-blue-300 rounded-xl p-4 mb-8 flex items-center gap-3 shadow-md">
          <span className="text-2xl">📧</span>
          <span className="text-gray-700">
            <strong className="text-blue-700">Default Assignee:</strong>{' '}
            Sri Gurusharanatmananda (zacchaeus.napuo@uskfoundation.or.ke)
          </span>
        </div>

        {/* Tabs */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 mb-8 shadow-xl">
          <div className="grid grid-cols-3 gap-3">
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
          {activeTab === 'analyze' && <AnalyzeTab />}
          {activeTab === 'notes' && <NotesTab />}
          {activeTab === 'history' && <HistoryTab />}
        </div>
      </div>
    </div>
  );
}
