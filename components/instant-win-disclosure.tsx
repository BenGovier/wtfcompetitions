import { Info, Zap } from "lucide-react"

export function InstantWinDisclosure() {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
      <div className="flex items-start gap-3">
        <Zap className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
        <div className="space-y-1">
          <h3 className="font-semibold text-amber-900 dark:text-amber-100">Instant Win Opportunities</h3>
          <p className="text-sm leading-relaxed text-amber-800 dark:text-amber-200">
            Some entries may include instant win prizes. If you win an instant prize, you'll be notified immediately
            after your payment is confirmed. Winners are selected randomly according to our fair play rules.
          </p>
          <div className="flex items-center gap-1 pt-1 text-xs text-amber-700 dark:text-amber-300">
            <Info className="h-3 w-3" aria-hidden="true" />
            <span>Confirmation provided only after successful payment processing</span>
          </div>
        </div>
      </div>
    </div>
  )
}
