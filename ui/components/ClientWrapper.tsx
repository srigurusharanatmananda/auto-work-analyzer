'use client';

/**
 * Client Wrapper Component
 * Wraps client-side providers around children
 */

import { AuthProvider } from '@/lib/context/AuthContext';

export default function ClientWrapper({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      {children}
    </AuthProvider>
  );
}
