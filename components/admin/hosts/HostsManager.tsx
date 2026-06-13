'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'
import { Loader2, Trash2, UserPlus } from 'lucide-react'
import {
  addHostByEmail,
  setHostEnabled,
  removeHost,
  type HostRow,
} from '@/app/admin/hosts/actions'

export function HostsManager({ initialHosts }: { initialHosts: HostRow[] }) {
  const { toast } = useToast()
  const [hosts, setHosts] = useState<HostRow[]>(initialHosts)
  const [email, setEmail] = useState('')
  const [isAdding, startAdd] = useTransition()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [removeTarget, setRemoveTarget] = useState<HostRow | null>(null)

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const value = email.trim()
    if (!value) return

    startAdd(async () => {
      const res = await addHostByEmail(value)
      if (res.ok) {
        toast({ title: 'Host added', description: `${value} can now access the Live Feed.` })
        setEmail('')
        // Optimistically reflect; full data refreshes via revalidatePath on navigation.
        setHosts((prev) => {
          if (prev.some((h) => h.email?.toLowerCase() === value.toLowerCase())) return prev
          return [...prev, { user_id: `temp-${value}`, email: value, is_enabled: true }]
        })
      } else {
        toast({ title: 'Could not add host', description: res.error, variant: 'destructive' })
      }
    })
  }

  function handleToggle(host: HostRow) {
    setPendingId(host.user_id)
    const next = !host.is_enabled
    setHostEnabled(host.user_id, next).then((res) => {
      setPendingId(null)
      if (res.ok) {
        setHosts((prev) =>
          prev.map((h) => (h.user_id === host.user_id ? { ...h, is_enabled: next } : h)),
        )
        toast({ title: next ? 'Host enabled' : 'Host disabled' })
      } else {
        toast({ title: 'Update failed', description: res.error, variant: 'destructive' })
      }
    })
  }

  function handleRemove(host: HostRow) {
    setPendingId(host.user_id)
    removeHost(host.user_id).then((res) => {
      setPendingId(null)
      setRemoveTarget(null)
      if (res.ok) {
        setHosts((prev) => prev.filter((h) => h.user_id !== host.user_id))
        toast({ title: 'Host removed' })
      } else {
        toast({ title: 'Remove failed', description: res.error, variant: 'destructive' })
      }
    })
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Add a Host</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Input
              type="email"
              placeholder="host@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isAdding}
              className="sm:max-w-sm"
              aria-label="Host email address"
            />
            <Button type="submit" disabled={isAdding || !email.trim()} className="gap-2">
              {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              Add Host
            </Button>
          </form>
          <p className="mt-2 text-xs text-muted-foreground">
            The person must already have a registered account. Hosts can only access the Live Feed.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Current Hosts</CardTitle>
        </CardHeader>
        <CardContent>
          {hosts.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No hosts yet. Add one above.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {hosts.map((host) => {
                  const busy = pendingId === host.user_id
                  return (
                    <TableRow key={host.user_id}>
                      <TableCell className="font-medium">{host.email ?? '—'}</TableCell>
                      <TableCell>
                        {host.is_enabled ? (
                          <Badge className="bg-green-600 hover:bg-green-600">Enabled</Badge>
                        ) : (
                          <Badge variant="secondary">Disabled</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={busy}
                            onClick={() => handleToggle(host)}
                          >
                            {busy ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : host.is_enabled ? (
                              'Disable'
                            ) : (
                              'Enable'
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={busy}
                            onClick={() => setRemoveTarget(host)}
                            className="text-destructive hover:text-destructive"
                            aria-label={`Remove ${host.email ?? 'host'}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!removeTarget} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this Host?</AlertDialogTitle>
            <AlertDialogDescription>
              {removeTarget?.email ?? 'This host'} will lose all admin access. This action can be
              undone by adding them again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => removeTarget && handleRemove(removeTarget)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
