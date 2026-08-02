'use client'

import { type KeyboardEvent } from 'react'
import { Check, Tag, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { discountErrorMessage } from '@/lib/discounts/customerErrorCopy'
import { canApply, type DiscountUiState } from '@/lib/checkout/discountUiState'

/**
 * Presentational discount-code field. All state transitions live in the pure
 * `discountUiState` reducer (owned by the parent); this component only renders
 * the current state and reports intent (change / apply / remove) upward.
 */
export interface DiscountCodeFieldProps {
  state: DiscountUiState
  /** Pence saved (from the applied discount) for the success message. */
  discountPence: number
  /** Shared GBP formatter so copy matches the rest of checkout. */
  formatGBP: (pence: number) => string
  disabled?: boolean
  onInputChange: (value: string) => void
  onApply: () => void
  onRemove: () => void
}

export function DiscountCodeField({
  state,
  discountPence,
  formatGBP,
  disabled = false,
  onInputChange,
  onApply,
  onRemove,
}: DiscountCodeFieldProps) {
  const isValidating = state.status === 'validating'
  const isApplied = state.status === 'applied' && state.applied !== null
  const showError = state.status === 'error' && state.errorCode !== null
  const applyEnabled = !disabled && canApply(state)

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    // Enter applies the code. Respect IME composition (CJK) and Safari's
    // unreliable final composition event (keyCode 229) to avoid submitting
    // mid-composition.
    if (event.key !== 'Enter') return
    if (event.nativeEvent.isComposing || event.keyCode === 229) return
    event.preventDefault()
    if (applyEnabled) onApply()
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-2 flex items-center gap-2">
        <Tag className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <h3 className="text-sm font-medium text-foreground">Discount code</h3>
      </div>

      {isApplied ? (
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tabular-nums text-foreground">
                {state.applied?.code}
              </p>
              <p className="text-xs text-muted-foreground">
                {"You're saving "}
                {formatGBP(discountPence)}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRemove}
            disabled={disabled}
            className="shrink-0"
          >
            <X className="mr-1 h-4 w-4" aria-hidden="true" />
            Remove
          </Button>
        </div>
      ) : (
        <div className="flex items-start gap-2">
          <div className="flex-1">
            <label htmlFor="discount-code-input" className="sr-only">
              Enter discount code
            </label>
            <Input
              id="discount-code-input"
              name="discount-code"
              type="text"
              inputMode="text"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              placeholder="Enter code"
              value={state.input}
              disabled={disabled || isValidating}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              aria-invalid={showError || undefined}
              aria-describedby={showError ? 'discount-code-error' : undefined}
              className="uppercase"
            />
          </div>
          <Button
            type="button"
            onClick={onApply}
            disabled={!applyEnabled}
            className="shrink-0"
          >
            {isValidating ? (
              <>
                <Spinner className="mr-2 h-4 w-4" aria-hidden="true" />
                Checking
              </>
            ) : (
              'Apply'
            )}
          </Button>
        </div>
      )}

      {/* Live region so assistive tech announces validation results. */}
      <div aria-live="polite" role="status" className="sr-only">
        {isApplied ? `Discount applied. You're saving ${formatGBP(discountPence)}.` : ''}
        {isValidating ? 'Checking discount code.' : ''}
      </div>

      {showError ? (
        <p id="discount-code-error" className="mt-2 text-sm text-destructive">
          {discountErrorMessage(state.errorCode)}
        </p>
      ) : null}
    </div>
  )
}
