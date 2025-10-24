'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';

export default function ReportPage() {
  const params = useParams();
  const router = useRouter();
  const reportId = params.id as string;

  useEffect(() => {
    router.replace(`/saved-reports/${reportId}/overview`);
  }, [reportId, router]);

  return (
    <ProtectedRoute>
      {null}
    </ProtectedRoute>
  );
}
