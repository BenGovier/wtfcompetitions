import { requireAdmin } from "@/lib/admin/auth"
import { CustomersList } from "@/components/admin/customers/CustomersList"

export default async function CustomersPage() {
  // Server-side guard. Mirrors the API allow-list: Super Admins + Operations
  // Admins only (Hosts / read_only are redirected to /auth/unauthorized).
  await requireAdmin({ roles: ['admin', 'operations_admin'] })

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold tracking-tight">Customers</h2>
        <p className="text-sm text-muted-foreground">
          Search customers, review purchases and manage account restrictions.
        </p>
      </div>

      <CustomersList />
    </div>
  )
}
