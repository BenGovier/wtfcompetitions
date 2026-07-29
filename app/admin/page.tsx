import { redirect } from 'next/navigation'
import { getAdminContext } from '@/lib/admin/auth'
import { ReportsDashboard } from '@/components/admin/reports/ReportsDashboard'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function AdminDashboard() {
  // Preserve existing role routing: hosts (ops) land on the live feed rather
  // than an unauthorized page; only full admins see finance figures.
  const adminContext = await getAdminContext()

  if (!adminContext) {
    redirect('/auth/unauthorized')
  }
  if (adminContext.role === 'ops') {
    redirect('/admin/live-feed')
  }
  if (adminContext.role !== 'admin') {
    redirect('/auth/unauthorized')
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          External payment revenue, gross ticket sales, and WTF Credit redeemed — never blended.
        </p>
      </div>
      <ReportsDashboard initialRange="today" />
    </div>
  )
}
