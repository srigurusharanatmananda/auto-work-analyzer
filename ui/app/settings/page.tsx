'use client';

import { useState } from 'react';
import { Card, Button, Input } from '@/lib/components/ui';
import toast from 'react-hot-toast';
import ProtectedRoute from '@/components/ProtectedRoute';

export default function SettingsPage() {
  const [assignee, setAssignee] = useState('Sri Gurusharanatmananda');
  const [backendUrl, setBackendUrl] = useState('http://localhost:3009');

  const handleSave = () => {
    // In a real app, this would save to localStorage or a backend
    toast.success('Settings saved successfully!');
  };

  return (
    <ProtectedRoute>
      <div className="p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Settings</h1>
        <p className="mt-2 text-foreground-secondary">
          Configure your application preferences
        </p>
      </div>

      <div className="max-w-2xl space-y-6">
        {/* General Settings */}
        <Card className="p-6">
          <h2 className="mb-4 text-xl font-semibold text-foreground">General Settings</h2>

          <div className="space-y-4">
            <Input
              label="Default Assignee"
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              placeholder="Enter assignee name"
            />

            <Input
              label="Backend URL"
              value={backendUrl}
              onChange={(e) => setBackendUrl(e.target.value)}
              placeholder="http://localhost:3009"
            />

            <Button onClick={handleSave} className="mt-4">
              Save Changes
            </Button>
          </div>
        </Card>

        {/* API Information */}
        <Card className="p-6">
          <h2 className="mb-4 text-xl font-semibold text-foreground">API Information</h2>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-foreground-secondary">Backend Status:</span>
              <span className="text-success">Connected</span>
            </div>
            <div className="flex justify-between">
              <span className="text-foreground-secondary">API Version:</span>
              <span className="text-foreground">1.0.0</span>
            </div>
            <div className="flex justify-between">
              <span className="text-foreground-secondary">Endpoint:</span>
              <code className="text-xs text-foreground">{backendUrl}</code>
            </div>
          </div>
        </Card>

        {/* About */}
        <Card className="p-6">
          <h2 className="mb-4 text-xl font-semibold text-foreground">About</h2>

          <div className="space-y-2 text-sm">
            <p className="text-foreground-secondary">
              <strong className="text-foreground">Auto Work Analyzer</strong>
            </p>
            <p className="text-foreground-secondary">
              Intelligent Git Commit Analysis & Automated Task Management
            </p>
            <p className="text-foreground-tertiary text-xs mt-4">
              Version 1.0.0
            </p>
          </div>
        </Card>
      </div>
    </div>
    </ProtectedRoute>
  );
}
