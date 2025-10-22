'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';

export default function HistoryTab() {
  const [loading, setLoading] = useState(false);

  const handleRefresh = () => {
    setLoading(true);
    toast.loading('🔄 Loading history...', { id: 'history' });

    setTimeout(() => {
      setLoading(false);
      toast.success('ℹ️ History feature coming soon!', {
        id: 'history',
        duration: 3000,
      });
    }, 1000);
  };

  return (
    <div className="bg-white rounded-2xl shadow-2xl p-8">
      <h2 className="text-3xl font-bold text-gray-800 mb-2 flex items-center gap-3">
        <span>📜</span>
        <span>Analysis History</span>
      </h2>
      <p className="text-gray-600 mb-8">
        View your recent analyses and created tasks
      </p>

      <button
        onClick={handleRefresh}
        disabled={loading}
        className="bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-semibold hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center gap-2 shadow-lg hover:shadow-xl"
      >
        {loading ? (
          <>
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span>Loading...</span>
          </>
        ) : (
          <>
            <span>🔄</span>
            <span>Refresh History</span>
          </>
        )}
      </button>

      <div className="mt-8 bg-blue-50 border-l-4 border-blue-500 p-6 rounded-r-xl">
        <div className="flex items-center gap-2">
          <span className="text-2xl">ℹ️</span>
          <p className="text-blue-700 font-medium">
            History feature coming soon! This will show your recent analyses and task creations.
          </p>
        </div>
      </div>
    </div>
  );
}
