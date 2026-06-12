import { requireAdmin } from "@/lib/admin/auth"
import { listHosts } from "./actions"
import { HostsManager } from "@/components/admin/hosts/HostsManager"

export default async function HostsPage() {
  // Full-admin-only page.
  await requireAdmin({ roles: ['admin'] })

  const result = await listHosts()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Hosts</h2>
        <p className="text-muted-foreground">
          Manage Host accounts. Hosts can only access the Live Feed.
        </p>
      </div>

      {result.ok ? (
        <HostsManager initialHosts={result.hosts ?? []} />
      ) : (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {result.error ?? 'Failed to load hosts.'}
        </div>
      )}
    </div>
  )
}
