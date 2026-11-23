import Link from 'next/link'

const NAV_ITEMS = [
  { href: '/heroes', label: 'Héroes', icon: '⚔️' },
  { href: '/attributes', label: 'Atributos', icon: '📊' },
]

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="border-b border-gray-800 bg-gray-900 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-gray-400 hover:text-gray-200 text-sm transition">&larr; Dashboard</Link>
            <span className="text-gray-700">|</span>
            <span className="font-semibold text-yellow-400 text-sm">Panel Admin</span>
          </div>
          <nav className="flex items-center gap-1">
            {NAV_ITEMS.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className="px-3 py-1.5 text-xs rounded transition text-gray-400 hover:text-gray-200 hover:bg-gray-800"
              >
                {item.icon} {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
      {children}
    </div>
  )
}
