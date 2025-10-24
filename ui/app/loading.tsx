import LoadingSpinner from '@/lib/components/ui/LoadingSpinner';

export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-foreground-secondary">Loading...</p>
      </div>
    </div>
  );
}
