import AdminLayout from '@/components/admin/AdminLayout'

export default function HeroesLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <AdminLayout>{children}</AdminLayout>
}
