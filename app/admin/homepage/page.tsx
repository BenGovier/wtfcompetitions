import { requireAdmin } from '@/lib/admin/auth'
import { loadHomepageMerchandising } from '@/lib/admin/homepage-merchandising'
import { HomepageManager } from '@/components/admin/homepage/HomepageManager'

/**
 * Homepage merchandising admin screen.
 *
 * Admin-only (Super Admin). The page is a Server Component: it guards access,
 * performs the SINGLE merchandising read (two parallel queries via the shared
 * loader), and hands the fully-ordered rails + eligible picker source to the
 * client manager. There is no query-per-rail and no client-side initial fetch.
 */
export default async function HomepageMerchandisingPage() {
  await requireAdmin({ roles: ['admin'] })

  const { rails, eligible } = await loadHomepageMerchandising()

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-3xl font-bold tracking-tight">Homepage Management</h2>
        <p className="text-sm text-muted-foreground">
          Configure which competitions appear in each homepage rail and the order they show in.
          Changes are staged locally and only persisted when you press{' '}
          <span className="font-medium text-foreground">Save Changes</span> for that rail.
        </p>
      </div>

      <HomepageManager initialRails={rails} eligible={eligible} />
    </div>
  )
}
