import EntriesPanel from "@/components/admin/entries/EntriesPanel"

export default function EntriesPage() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Entries</h2>
        <p className="text-muted-foreground">
          View and manage participant entries
        </p>
      </div>

      <EntriesPanel />
    </div>
  )
}
