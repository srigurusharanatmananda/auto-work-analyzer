import LoadingSpinner from '@/lib/components/ui/LoadingSpinner';

export default function Loading() {
  return (
    <div className="flex min-h-[600px] items-center justify-center">
      <div className="text-center">
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-foreground-secondary">Loading report tools...</p>
      </div>
    </div>
  );
}
