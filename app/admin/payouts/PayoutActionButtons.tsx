'use client'

import { useState, useTransition } from 'react'
import { updatePayoutStatus } from './actions'

interface PayoutActionButtonsProps {
  id: string
  currentStatus: string | null
}

export function PayoutActionButtons({ id, currentStatus }: PayoutActionButtonsProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleStatusUpdate = (newStatus: 'in_progress' | 'paid' | 'problem') => {
    setError(null)
    startTransition(async () => {
      const result = await updatePayoutStatus(id, newStatus)
      if (!result.ok) {
        setError(result.error || 'Update failed')
      }
    })
  }

  // Don't show actions if already paid
  if (currentStatus === 'paid') {
    return <span className="text-xs text-gray-400">Paid</span>
  }

  return (
    <div className="flex items-center gap-1">
      {currentStatus !== 'in_progress' && currentStatus !== 'processing' && (
        <button
          onClick={() => handleStatusUpdate('in_progress')}
          disabled={isPending}
          className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 hover:bg-blue-200 disabled:opacity-50"
          title="Mark as processing"
        >
          {isPending ? '...' : 'Proc'}
        </button>
      )}
      <button
        onClick={() => handleStatusUpdate('paid')}
        disabled={isPending}
        className="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 hover:bg-green-200 disabled:opacity-50"
        title="Mark as paid"
      >
        {isPending ? '...' : 'Paid'}
      </button>
      {currentStatus !== 'problem' && (
        <button
          onClick={() => handleStatusUpdate('problem')}
          disabled={isPending}
          className="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 hover:bg-red-200 disabled:opacity-50"
          title="Mark as problem"
        >
          {isPending ? '...' : 'Prob'}
        </button>
      )}
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  )
}
