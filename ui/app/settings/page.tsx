'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/context/AuthContext';
import { Card, Button, Input, LoadingSpinner } from '@/lib/components/ui';
import toast from 'react-hot-toast';
import ProtectedRoute from '@/components/ProtectedRoute';

const BACKEND_URL = 'http://localhost:3009';

interface UserSettings {
  default_assignee?: string;
  backend_url?: string;
  clickup_api_key?: string;
  clickup_team_id?: string;
  clickup_list_id?: string;
}

export default function SettingsPage() {
  const { user, accessToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [assignee, setAssignee] = useState('');
  const [backendUrl, setBackendUrl] = useState('http://localhost:3009');
  const [clickupApiKey, setClickupApiKey] = useState('');
  const [clickupTeamId, setClickupTeamId] = useState('');
  const [clickupListId, setClickupListId] = useState('');
  const [showClickupKey, setShowClickupKey] = useState(false);

  // Load settings from backend
  useEffect(() => {
    if (accessToken) {
      loadSettings();
    }
  }, [accessToken]);

  const loadSettings = async () => {
    if (!accessToken) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/settings`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        credentials: 'include',
      });
      const result = await response.json();

      if (result.success && result.data) {
        const settings: UserSettings = result.data;
        setAssignee(settings.default_assignee || '');
        setBackendUrl(settings.backend_url || 'http://localhost:3009');
        setClickupApiKey(settings.clickup_api_key || '');
        setClickupTeamId(settings.clickup_team_id || '');
        setClickupListId(settings.clickup_list_id || '');
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!accessToken) {
      toast.error('Not authenticated');
      return;
    }

    setSaving(true);
    const toastId = toast.loading('Saving settings...');

    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        credentials: 'include',
        body: JSON.stringify({
          default_assignee: assignee,
          backend_url: backendUrl,
          clickup_api_key: clickupApiKey,
          clickup_team_id: clickupTeamId,
          clickup_list_id: clickupListId,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Settings saved successfully!', { id: toastId });
      } else {
        toast.error(`Failed to save settings: ${result.error}`, { id: toastId });
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast.error('Failed to save settings', { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="flex items-center justify-center min-h-screen">
          <LoadingSpinner size="lg" />
        </div>
      </ProtectedRoute>
    );
  }

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
          {/* User Profile */}
          {user && (
            <Card className="p-6">
              <h2 className="mb-4 text-xl font-semibold text-foreground">User Profile</h2>

              <div className="space-y-3">
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary text-white text-2xl font-bold">
                    {user.full_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-foreground">{user.full_name}</h3>
                    <p className="text-sm text-foreground-secondary">{user.email}</p>
                    <div className="flex gap-2 mt-1">
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-primary/10 text-primary">
                        {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                      </span>
                      {user.email_verified && (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-success/10 text-success">
                          Verified
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-foreground-secondary">Member Since</div>
                    <div className="font-medium text-foreground">
                      {new Date(user.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </div>
                  </div>
                  {user.last_login_at && (
                    <div>
                      <div className="text-foreground-secondary">Last Login</div>
                      <div className="font-medium text-foreground">
                        {new Date(user.last_login_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* General Settings */}
          <Card className="p-6">
            <h2 className="mb-4 text-xl font-semibold text-foreground">General Settings</h2>

            <div className="space-y-4">
              <div>
                <label htmlFor="assignee" className="block text-sm font-medium text-foreground mb-2">
                  Default Assignee
                </label>
                <input
                  id="assignee"
                  type="text"
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
                  placeholder="Enter assignee name (e.g., Sri Gurusharanatmananda)"
                  className="w-full px-4 py-3 border border-border bg-background-tertiary text-foreground rounded-xl focus:outline-none focus:ring-2 focus:ring-primary transition-colors placeholder:text-foreground-tertiary"
                />
                <p className="text-xs text-foreground-tertiary mt-1">
                  This will be used as the default name for reports and EOD summaries
                </p>
              </div>

              <div>
                <label htmlFor="backendUrl" className="block text-sm font-medium text-foreground mb-2">
                  Backend URL
                </label>
                <input
                  id="backendUrl"
                  type="url"
                  value={backendUrl}
                  onChange={(e) => setBackendUrl(e.target.value)}
                  placeholder="http://localhost:3009"
                  className="w-full px-4 py-3 border border-border bg-background-tertiary text-foreground rounded-xl focus:outline-none focus:ring-2 focus:ring-primary transition-colors placeholder:text-foreground-tertiary"
                />
                <p className="text-xs text-foreground-tertiary mt-1">
                  The URL where the backend API server is running
                </p>
              </div>
            </div>
          </Card>

          {/* ClickUp Integration */}
          <Card className="p-6">
            <h2 className="mb-4 text-xl font-semibold text-foreground">ClickUp Integration</h2>

            <div className="space-y-4">
              <div>
                <label htmlFor="clickupApiKey" className="block text-sm font-medium text-foreground mb-2">
                  API Key
                </label>
                <div className="relative">
                  <input
                    id="clickupApiKey"
                    type={showClickupKey ? 'text' : 'password'}
                    value={clickupApiKey}
                    onChange={(e) => setClickupApiKey(e.target.value)}
                    placeholder="Enter your ClickUp API key"
                    className="w-full px-4 py-3 pr-12 border border-border bg-background-tertiary text-foreground rounded-xl focus:outline-none focus:ring-2 focus:ring-primary transition-colors placeholder:text-foreground-tertiary"
                  />
                  <button
                    type="button"
                    onClick={() => setShowClickupKey(!showClickupKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-secondary hover:text-foreground transition-colors"
                  >
                    {showClickupKey ? '🙈' : '👁️'}
                  </button>
                </div>
                <p className="text-xs text-foreground-tertiary mt-1">
                  Your ClickUp personal API token for creating tasks
                </p>
              </div>

              <div>
                <label htmlFor="clickupTeamId" className="block text-sm font-medium text-foreground mb-2">
                  Team ID
                </label>
                <input
                  id="clickupTeamId"
                  type="text"
                  value={clickupTeamId}
                  onChange={(e) => setClickupTeamId(e.target.value)}
                  placeholder="Enter your ClickUp team ID"
                  className="w-full px-4 py-3 border border-border bg-background-tertiary text-foreground rounded-xl focus:outline-none focus:ring-2 focus:ring-primary transition-colors placeholder:text-foreground-tertiary"
                />
              </div>

              <div>
                <label htmlFor="clickupListId" className="block text-sm font-medium text-foreground mb-2">
                  List ID
                </label>
                <input
                  id="clickupListId"
                  type="text"
                  value={clickupListId}
                  onChange={(e) => setClickupListId(e.target.value)}
                  placeholder="Enter your ClickUp list ID"
                  className="w-full px-4 py-3 border border-border bg-background-tertiary text-foreground rounded-xl focus:outline-none focus:ring-2 focus:ring-primary transition-colors placeholder:text-foreground-tertiary"
                />
                <p className="text-xs text-foreground-tertiary mt-1">
                  The default list where tasks will be created
                </p>
              </div>
            </div>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button
              onClick={handleSave}
              disabled={saving}
              variant="primary"
              className="min-w-[150px]"
            >
              {saving ? (
                <>
                  <LoadingSpinner size="sm" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Changes</span>
              )}
            </Button>
          </div>

          {/* Task Templates */}
          <Card className="p-6">
            <h2 className="mb-4 text-xl font-semibold text-foreground">Task Templates</h2>
            <Link
              href="/settings/templates"
              className="flex items-center gap-3 rounded-md px-3 py-2 -mx-3 text-sm font-medium text-foreground-secondary transition-colors hover:bg-background-tertiary hover:text-foreground"
            >
              <svg className="h-5 w-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
              Manage task templates
            </Link>
            <p className="text-xs text-foreground-tertiary mt-1">
              Control how work items are rendered into ClickUp task names and descriptions
            </p>
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
