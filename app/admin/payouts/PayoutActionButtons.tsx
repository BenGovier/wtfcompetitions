'use client'

import { useState, useTransition } from 'react'
import { updatePayoutStatus, deletePayout } from './actions'

interface PayoutActionButtonsProps {
  id: string
  currentStatus: string | null
}

export function PayoutActionButtons({ id, currentStatus }: PayoutActionButtonsProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleStatusUpdate = (newStatus: 'new' | 'paid' | 'problem', requireConfirm?: string) => {
    if (requireConfirm && !window.confirm(requireConfirm)) {
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await updatePayoutStatus(id, newStatus)
      if (!result.ok) {
        setError(result.error || 'Update failed')
      }
    })
  }

  const handleDelete = () => {
    if (!window.confirm('Are you sure you want to delete this payout submission? This cannot be undone.')) {
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await deletePayout(id)
      if (!result.ok) {
        setError(result.error || 'Delete failed')
      }
    })
  }

  const buttonBase = "rounded px-2 py-0.5 text-xs font-medium disabled:opacity-50"

  // For paid rows: show Unpaid and Delete
  if (currentStatus === 'paid') {
    return (
      <div className="flex items-center gap-1">
        <button
          onClick={() => handleStatusUpdate('new', 'Are you sure you want to mark this payout as unpaid again?')}
          disabled={isPending}
          className={`${buttonBase} bg-yellow-100 text-yellow-700 hover:bg-yellow-200`}
          title="Mark as unpaid"
        >
          {isPending ? '...' : 'Unpaid'}
        </button>
        <button
          onClick={handleDelete}
          disabled={isPending}
          className={`${buttonBase} bg-gray-100 text-gray-700 hover:bg-gray-200`}
          title="Delete submission"
        >
          {isPending ? '...' : 'Del'}
        </button>
        {error && <span className="text-xs text-red-500">{error}</span>}
      </div>
    )
  }

  // For problem rows: show Paid, Unpaid, Delete
  if (currentStatus === 'problem') {
    return (
      <div className="flex items-center gap-1">
        <button
          onClick={() => handleStatusUpdate('paid')}
          disabled={isPending}
          className={`${buttonBase} bg-green-100 text-green-700 hover:bg-green-200`}
          title="Mark as paid"
        >
          {isPending ? '...' : 'Paid'}
        </button>
        <button
          onClick={() => handleStatusUpdate('new')}
          disabled={isPending}
          className={`${buttonBase} bg-yellow-100 text-yellow-700 hover:bg-yellow-200`}
          title="Mark as unpaid/new"
        >
          {isPending ? '...' : 'Unpaid'}
        </button>
        <button
          onClick={handleDelete}
          disabled={isPending}
          className={`${buttonBase} bg-gray-100 text-gray-700 hover:bg-gray-200`}
          title="Delete submission"
        >
          {isPending ? '...' : 'Del'}
        </button>
        {error && <span className="text-xs text-red-500">{error}</span>}
      </div>
    )
  }

  // For unpaid/new rows: show Paid, Problem, Delete
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => handleStatusUpdate('paid')}
        disabled={isPending}
        className={`${buttonBase} bg-green-100 text-green-700 hover:bg-green-200`}
        title="Mark as paid"
      >
        {isPending ? '...' : 'Paid'}
      </button>
      <button
        onClick={() => handleStatusUpdate('problem')}
        disabled={isPending}
        className={`${buttonBase} bg-red-100 text-red-700 hover:bg-red-200`}
        title="Mark as problem"
      >
        {isPending ? '...' : 'Prob'}
      </button>
      <button
        onClick={handleDelete}
        disabled={isPending}
        className={`${buttonBase} bg-gray-100 text-gray-700 hover:bg-gray-200`}
        title="Delete submission"
      >
        {isPending ? '...' : 'Del'}
      </button>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  )
}
