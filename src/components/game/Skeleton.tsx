"use client"

export function SkeletonLine({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-800 rounded h-4 ${className}`} />
}

export function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-800 rounded-xl ${className}`} />
}

export function DashboardSkeleton() {
  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex items-center gap-4">
        <SkeletonBlock className="w-16 h-16 rounded-full" />
        <div className="space-y-2 flex-1">
          <SkeletonLine className="w-48" />
          <SkeletonLine className="w-32 h-3" />
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map(i => (
          <SkeletonBlock key={i} className="h-20" />
        ))}
      </div>
      <SkeletonBlock className="h-48" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <SkeletonBlock className="h-32" />
        <SkeletonBlock className="h-32" />
      </div>
    </div>
  )
}

export function PageSkeleton() {
  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-4">
      <SkeletonLine className="w-64 h-6" />
      <SkeletonBlock className="h-12" />
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <SkeletonBlock key={i} className="h-20" />
        ))}
      </div>
    </div>
  )
}
