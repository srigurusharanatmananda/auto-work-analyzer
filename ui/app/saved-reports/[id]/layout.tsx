'use client';

import { useParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export default function ReportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const pathname = usePathname();
  const reportId = params.id as string;

  const tabs = [
    { name: 'Overview', href: `/saved-reports/${reportId}/overview` },
    { name: 'Summary', href: `/saved-reports/${reportId}/summary` },
    { name: 'Detailed', href: `/saved-reports/${reportId}/detailed` },
  ];

  return (
    <div className="p-8">
      {/* Back button */}
      <div className="mb-6">
        <Link
          href="/saved-reports"
          className="text-primary hover:text-primary-hover font-medium flex items-center gap-2 transition-colors"
        >
          ← Back to Reports
        </Link>
      </div>

      {/* Tab Navigation */}
      <div className="mb-6 border-b border-border">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {tabs.map((tab) => {
            const isActive = pathname === tab.href;
            return (
              <Link
                key={tab.name}
                href={tab.href}
                className={cn(
                  'whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium transition-colors',
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-foreground-secondary hover:border-border-hover hover:text-foreground'
                )}
              >
                {tab.name}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Content */}
      {children}
    </div>
  );
}
