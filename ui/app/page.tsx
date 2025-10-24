'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, Button } from '@/lib/components/ui';
import { cn } from '@/lib/utils';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/lib/context/AuthContext';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
  trendUp?: boolean;
}

function StatCard({ title, value, icon, trend, trendUp }: StatCardProps) {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground-secondary">{title}</p>
          <p className="mt-2 text-3xl font-semibold text-foreground">{value}</p>
          {trend && (
            <p className={cn(
              'mt-2 text-sm',
              trendUp ? 'text-success' : 'text-error'
            )}>
              {trend}
            </p>
          )}
        </div>
        <div className="text-foreground-tertiary">
          {icon}
        </div>
      </div>
    </Card>
  );
}

export default function Dashboard() {
  const { accessToken } = useAuth();
  const [stats, setStats] = useState({
    totalAnalyses: 0,
    totalWorkItems: 0,
    totalTasks: 0,
  });

  useEffect(() => {
    if (!accessToken) return;

    // Fetch stats from API
    fetch('http://localhost:3009/api/history?limit=1', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
      credentials: 'include',
    })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data.statistics) {
          setStats({
            totalAnalyses: data.data.statistics.totalAnalyses || 0,
            totalWorkItems: data.data.statistics.totalWorkItems || 0,
            totalTasks: data.data.statistics.totalTasks || 0,
          });
        }
      })
      .catch(err => console.error('Failed to fetch stats:', err));
  }, [accessToken]);

  const quickActions = [
    {
      title: 'Analyze Commits',
      description: 'Analyze git commits and generate work items',
      icon: (
        <svg className="h-6 w-6" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
          <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      href: '/analyze',
      color: 'primary',
    },
    {
      title: 'View Reports',
      description: 'Browse and manage saved reports',
      icon: (
        <svg className="h-6 w-6" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
          <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
        </svg>
      ),
      href: '/saved-reports',
      color: 'secondary',
    },
    {
      title: 'Upload Notes',
      description: 'Convert notes to structured work items',
      icon: (
        <svg className="h-6 w-6" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
          <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      ),
      href: '/notes',
      color: 'success',
    },
  ];

  return (
    <ProtectedRoute>
      <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="mt-2 text-foreground-secondary">
            Welcome back! Here's an overview of your work analysis.
          </p>
        </div>

        {/* Stats */}
        <div className="mb-8 grid gap-6 md:grid-cols-3">
          <StatCard
            title="Total Analyses"
            value={stats.totalAnalyses}
            icon={
              <svg className="h-8 w-8" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            }
          />
          <StatCard
            title="Work Items"
            value={stats.totalWorkItems}
            icon={
              <svg className="h-8 w-8" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            }
          />
          <StatCard
            title="Tasks Created"
            value={stats.totalTasks}
            icon={
              <svg className="h-8 w-8" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="mb-4 text-xl font-semibold text-foreground">Quick Actions</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {quickActions.map((action) => (
              <Link key={action.href} href={action.href}>
                <Card hover className="p-6 transition-all cursor-pointer">
                  <div className="flex items-start gap-4">
                    <div className={cn(
                      'rounded-lg p-3',
                      action.color === 'primary' && 'bg-primary/10 text-primary',
                      action.color === 'secondary' && 'bg-secondary/10 text-secondary',
                      action.color === 'success' && 'bg-success/10 text-success'
                    )}>
                      {action.icon}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground">{action.title}</h3>
                      <p className="mt-1 text-sm text-foreground-secondary">{action.description}</p>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        {/* Info Card */}
        <Card className="p-6">
          <div className="flex items-start gap-4">
            <div className="rounded-lg bg-primary/10 p-3 text-primary">
              <svg className="h-6 w-6" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Getting Started</h3>
              <p className="mt-1 text-sm text-foreground-secondary">
                Start by analyzing your git commits or uploading notes to automatically generate work items and tasks.
                All tasks will be assigned to Sri Gurusharanatmananda by default.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </ProtectedRoute>
  );
}
