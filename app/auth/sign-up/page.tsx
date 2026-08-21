'use client'

import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, Lock } from 'lucide-react'
import { validateCustomerName } from '@/lib/acquired/customer-name'
import { MARKETING_CONSENT_LABEL } from '@/lib/marketing/consent'

const TOTAL_STEPS = 4

/**
 * CSS-only wizard step transition: a slight fade + ~22px horizontal slide.
 * Direction is driven by the data-dir attribute the container sets before each
 * step change. No animation library, no layout-property animation (transform +
 * opacity only), so there is no CLS. Reduced-motion users get an instant swap.
 */
const WIZARD_STYLES = `
@keyframes wtf-step-fwd { from { opacity: 0; transform: translateX(22px); } to { opacity: 1; transform: translateX(0); } }
@keyframes wtf-step-back { from { opacity: 0; transform: translateX(-22px); } to { opacity: 1; transform: translateX(0); } }
.wtf-step { animation: wtf-step-fwd 260ms cubic-bezier(0.22, 1, 0.36, 1); }
.wtf-step[data-dir="back"] { animation-name: wtf-step-back; }
@media (prefers-reduced-motion: reduce) {
  .wtf-step { animation: none; }
}
`

// Shared field styling — premium dark-purple surface, thin low-contrast border,
// large touch target (h-12), 16px text to avoid iOS zoom, magenta focus glow.
const FIELD_BASE =
  'h-12 rounded-xl border-purple-400/20 bg-[#0c0518] text-base text-white placeholder:text-purple-300/30 transition-colors focus-visible:border-fuchsia-400/70 focus-visible:ring-2 focus-visible:ring-fuchsia-500/25 focus-visible:ring-offset-0'

function fieldClass(hasError: boolean) {
  return hasError
    ? `${FIELD_BASE} border-pink-500/70 focus-visible:border-pink-500 focus-visible:ring-pink-500/25`
    : FIELD_BASE
}

const LABEL_CLASS = 'text-sm font-medium text-purple-100'
const ERROR_CLASS = 'text-sm text-pink-400'

export default function SignUpPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [mobile, setMobile] = useState('')
  // Marketing consent is OPTIONAL and CHECKED by default. It never blocks
  // account creation and the customer can untick it before submitting. The
  // choice is carried on the existing signUp call via user metadata and only
  // turned into a real, gated marketing preference server-side once a valid
  // authenticated user exists (see app/auth/callback), using consent source
  // 'signup' and the current consent version. Unticking means no enabled
  // preference is ever created.
  const [marketingOptIn, setMarketingOptIn] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mobileError, setMobileError] = useState<string | null>(null)
  const [firstNameError, setFirstNameError] = useState<string | null>(null)
  const [lastNameError, setLastNameError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [confirmMessage, setConfirmMessage] = useState(false)

  // ---- Wizard UI state (presentation only — no effect on submission) -------
  const [step, setStep] = useState(1)
  const [direction, setDirection] = useState<'fwd' | 'back'>('fwd')
  const [showPassword, setShowPassword] = useState(false)
  // UI-only field errors used to gate step advancement. The final submit still
  // runs the untouched handleSignUp, so these never change what is submitted.
  const [emailError, setEmailError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const stepRef = useRef<HTMLDivElement>(null)

  // Move keyboard focus to the first field when the active step changes. Uses
  // preventScroll so mobile doesn't jump, and only targets text inputs (Step 4
  // has no text field, so nothing is force-focused there).
  useEffect(() => {
    const firstInput = stepRef.current?.querySelector<HTMLInputElement>('input')
    if (firstInput) {
      try {
        firstInput.focus({ preventScroll: true })
      } catch {
        firstInput.focus()
      }
    }
  }, [step])

  // handleSignUp is intentionally UNCHANGED from the original implementation:
  // same validation, same Supabase signUp call, same metadata, same redirect
  // and confirm-email behaviour. Only the surrounding UI has changed.
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setMobileError(null)
    setError(null)
    setFirstNameError(null)
    setLastNameError(null)

    // Validate first/last name against Acquired's confirmed rules so we do not
    // store data the payment provider will reject at checkout. Legitimate
    // hyphenated / apostrophe / accented names are accepted (accents/smart
    // punctuation are folded to their ASCII form), and the NORMALISED value is
    // what we persist. Server-side checkout validation remains authoritative.
    const firstResult = validateCustomerName(firstName, 'first_name')
    if (!firstResult.ok) {
      setFirstNameError(
        firstResult.error === 'customer_name_required'
          ? 'Please enter your first name.'
          : 'Please use only letters, spaces, hyphens and apostrophes (up to 50 characters).',
      )
      setDirection('back')
      setStep(1)
      return
    }

    const lastResult = validateCustomerName(lastName, 'last_name')
    if (!lastResult.ok) {
      setLastNameError(
        lastResult.error === 'customer_name_required'
          ? 'Please enter your last name.'
          : 'Please use only letters, spaces, hyphens and apostrophes (up to 50 characters).',
      )
      setDirection('back')
      setStep(1)
      return
    }

    // Normalised, Acquired-safe values to store on the account.
    const normalizedFirstName = firstResult.value
    const normalizedLastName = lastResult.value

    // Validate mobile is provided
    if (!mobile.trim()) {
      setMobileError('Mobile number is required')
      setDirection('back')
      setStep(2)
      return
    }

    // Auto-fill display_name from first_name + last initial if blank
    let finalDisplayName = displayName.trim()
    if (!finalDisplayName && normalizedFirstName) {
      const lastInitial = normalizedLastName.charAt(0).toUpperCase()
      finalDisplayName = lastInitial
        ? `${normalizedFirstName} ${lastInitial}`
        : normalizedFirstName
    }

    const supabase = createClient()
    setIsLoading(true)

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: finalDisplayName || undefined,
            first_name: normalizedFirstName,
            last_name: normalizedLastName,
            mobile: mobile.trim(),
            // Carried on the existing registration request (no extra network
            // call). Applied to the gated marketing tables only after the user
            // is authenticated. Absent/false => user stays ineligible.
            marketing_opt_in: marketingOptIn,
          },
        },
      })

      if (signUpError) throw signUpError

      // If Supabase email confirmation is enabled, user/session will be null
      if (!data.session && !data.user?.confirmed_at) {
        setConfirmMessage(true)
        return
      }

      // Auto-confirmed — redirect to /me
      window.location.href = '/me'
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  // ---- Step navigation (client-side only, never submits) -------------------
  function goToStep(next: number, dir: 'fwd' | 'back') {
    setDirection(dir)
    setStep(Math.min(Math.max(next, 1), TOTAL_STEPS))
  }

  function goBack() {
    if (step > 1) goToStep(step - 1, 'back')
  }

  // Validate the CURRENT step using the exact same rules/messages as the final
  // submit, then advance. Returns without advancing if the step is invalid.
  function goNext() {
    if (step === 1) {
      const firstResult = validateCustomerName(firstName, 'first_name')
      if (!firstResult.ok) {
        setFirstNameError(
          firstResult.error === 'customer_name_required'
            ? 'Please enter your first name.'
            : 'Please use only letters, spaces, hyphens and apostrophes (up to 50 characters).',
        )
        return
      }
      const lastResult = validateCustomerName(lastName, 'last_name')
      if (!lastResult.ok) {
        setLastNameError(
          lastResult.error === 'customer_name_required'
            ? 'Please enter your last name.'
            : 'Please use only letters, spaces, hyphens and apostrophes (up to 50 characters).',
        )
        return
      }
      setFirstNameError(null)
      setLastNameError(null)
      goToStep(2, 'fwd')
      return
    }

    if (step === 2) {
      // Basic presence/format gate only — server auth remains authoritative.
      if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        setEmailError('Please enter a valid email address.')
        return
      }
      if (!mobile.trim()) {
        setMobileError('Mobile number is required')
        return
      }
      setEmailError(null)
      setMobileError(null)
      goToStep(3, 'fwd')
      return
    }

    if (step === 3) {
      // Preserve the existing password requirement (minLength 6).
      if (password.length < 6) {
        setPasswordError('Password must be at least 6 characters.')
        return
      }
      setPasswordError(null)
      goToStep(4, 'fwd')
      return
    }
  }

  // Enter advances the wizard on steps 1–3 (instead of submitting). Respects
  // IME composition so CJK input confirmation is never treated as submit.
  function handleFieldKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    if (e.nativeEvent.isComposing || e.keyCode === 229) return
    if (step < TOTAL_STEPS) {
      e.preventDefault()
      goNext()
    }
  }

  if (confirmMessage) {
    return (
      <div className="relative flex min-h-svh w-full items-center justify-center overflow-hidden bg-[#080312] px-6 pt-10 pb-28 md:p-10">
        <WizardBackdrop />
        <div className="relative z-10 w-full max-w-[520px]">
          <div className="flex flex-col items-center">
            <BrandLogo />
            <div className="mt-6 w-full rounded-2xl border border-purple-500/25 bg-[#130a22]/90 p-7 text-center shadow-[0_0_40px_-12px_rgba(168,82,255,0.35)]">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-fuchsia-500/15 text-fuchsia-300 shadow-[0_0_26px_rgba(217,70,239,0.4)]">
                <Check className="h-7 w-7" aria-hidden="true" />
              </div>
              <h1 className="mt-4 text-2xl font-extrabold text-white">Check your email</h1>
              <p className="mt-2 text-sm leading-relaxed text-purple-200/80">
                We sent a confirmation link to <strong className="text-white">{email}</strong>. Click the link
                in the email to activate your account.
              </p>
              <Link
                href="/auth/login"
                className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-xl border border-purple-400/30 bg-white/5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                Back to sign in
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex min-h-svh w-full items-center justify-center overflow-hidden bg-[#080312] px-4 pt-8 pb-28 md:py-12">
      <style dangerouslySetInnerHTML={{ __html: WIZARD_STYLES }} />
      <WizardBackdrop />

      <div className="relative z-10 w-full max-w-[520px]">
        <div className="flex flex-col items-center">
          <BrandLogo />
          <h1 className="mt-5 text-balance text-center text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
            Create your account
          </h1>
          <p className="mt-1 text-center text-sm text-purple-200/70">
            Enter cash giveaways, reveal instant wins, track your tickets.
          </p>
        </div>

        <div className="mt-6 rounded-2xl border border-purple-500/25 bg-[#130a22]/90 p-5 shadow-[0_0_44px_-14px_rgba(168,82,255,0.4)] backdrop-blur-sm sm:p-7">
          <StepProgress step={step} />

          <form onSubmit={handleSignUp} noValidate>
            {/* Keyed on step so the entrance animation replays each transition.
                Only the active step is mounted; values persist in React state,
                so going Back always restores what was entered. */}
            <div key={step} ref={stepRef} data-dir={direction} className="wtf-step mt-6">
              {step === 1 && (
                <div className="min-h-[248px]">
                  <StepHeader
                    index={1}
                    title="What's your name?"
                    subtitle="Let's start with the basics."
                  />
                  <div className="mt-5 flex flex-col gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="first-name" className={LABEL_CLASS}>
                        First name
                      </Label>
                      <Input
                        id="first-name"
                        type="text"
                        placeholder="First name"
                        required
                        autoComplete="given-name"
                        aria-invalid={Boolean(firstNameError)}
                        className={fieldClass(Boolean(firstNameError))}
                        value={firstName}
                        onChange={(e) => {
                          setFirstName(e.target.value)
                          if (firstNameError) setFirstNameError(null)
                        }}
                        onKeyDown={handleFieldKeyDown}
                      />
                      {firstNameError && <p className={ERROR_CLASS}>{firstNameError}</p>}
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="last-name" className={LABEL_CLASS}>
                        Last name
                      </Label>
                      <Input
                        id="last-name"
                        type="text"
                        placeholder="Last name"
                        required
                        autoComplete="family-name"
                        aria-invalid={Boolean(lastNameError)}
                        className={fieldClass(Boolean(lastNameError))}
                        value={lastName}
                        onChange={(e) => {
                          setLastName(e.target.value)
                          if (lastNameError) setLastNameError(null)
                        }}
                        onKeyDown={handleFieldKeyDown}
                      />
                      {lastNameError && <p className={ERROR_CLASS}>{lastNameError}</p>}
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="min-h-[248px]">
                  <StepHeader
                    index={2}
                    title="How can we reach you?"
                    subtitle="We use these details for your account and important prize updates."
                  />
                  <div className="mt-5 flex flex-col gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="email" className={LABEL_CLASS}>
                        Email address
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        inputMode="email"
                        placeholder="you@example.com"
                        required
                        autoComplete="email"
                        aria-invalid={Boolean(emailError)}
                        className={fieldClass(Boolean(emailError))}
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value)
                          if (emailError) setEmailError(null)
                        }}
                        onKeyDown={handleFieldKeyDown}
                      />
                      {emailError && <p className={ERROR_CLASS}>{emailError}</p>}
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="mobile" className={LABEL_CLASS}>
                        Mobile number
                      </Label>
                      <Input
                        id="mobile"
                        type="tel"
                        inputMode="tel"
                        placeholder="+44 7700 900000"
                        required
                        autoComplete="tel"
                        aria-invalid={Boolean(mobileError)}
                        className={fieldClass(Boolean(mobileError))}
                        value={mobile}
                        onChange={(e) => {
                          setMobile(e.target.value)
                          if (mobileError) setMobileError(null)
                        }}
                        onKeyDown={handleFieldKeyDown}
                      />
                      {mobileError && <p className={ERROR_CLASS}>{mobileError}</p>}
                    </div>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="min-h-[248px]">
                  <StepHeader
                    index={3}
                    title="Make it yours"
                    subtitle="Choose how you'll appear if you win, and set a password."
                  />
                  <div className="mt-5 flex flex-col gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="display-name" className={LABEL_CLASS}>
                        Winner display name{' '}
                        <span className="font-normal text-purple-300/60">(optional)</span>
                      </Label>
                      <Input
                        id="display-name"
                        type="text"
                        placeholder="Your public winner name"
                        autoComplete="nickname"
                        className={fieldClass(false)}
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        onKeyDown={handleFieldKeyDown}
                      />
                      <p className="text-xs text-purple-300/60">
                        Shown publicly if you win. Leave blank to auto-generate from your name.
                      </p>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="password" className={LABEL_CLASS}>
                        Password
                      </Label>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showPassword ? 'text' : 'password'}
                          required
                          minLength={6}
                          autoComplete="new-password"
                          aria-invalid={Boolean(passwordError)}
                          className={`${fieldClass(Boolean(passwordError))} pr-11`}
                          value={password}
                          onChange={(e) => {
                            setPassword(e.target.value)
                            if (passwordError) setPasswordError(null)
                          }}
                          onKeyDown={handleFieldKeyDown}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                          className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-purple-300/70 transition-colors hover:text-white"
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" aria-hidden="true" />
                          ) : (
                            <Eye className="h-4 w-4" aria-hidden="true" />
                          )}
                        </button>
                      </div>
                      {passwordError ? (
                        <p className={ERROR_CLASS}>{passwordError}</p>
                      ) : (
                        <p className="text-xs text-purple-300/60">At least 6 characters.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="min-h-[248px]">
                  <StepHeader
                    index={4}
                    title="You're almost in!"
                    subtitle="One quick check and you're ready to start winning."
                  />

                  {/* Compact account summary — reassuring, not a data-entry step. */}
                  <dl className="mt-5 grid gap-2 rounded-xl border border-purple-400/15 bg-[#0c0518] p-4 text-sm">
                    <SummaryRow label="Name" value={`${firstName} ${lastName}`.trim() || '—'} />
                    <SummaryRow label="Email" value={email || '—'} />
                    <SummaryRow label="Mobile" value={mobile || '—'} />
                  </dl>

                  {/* Required legal acceptance (implicit today — no gate added). */}
                  <p className="mt-4 text-xs leading-relaxed text-purple-200/70">
                    By creating an account you agree to our{' '}
                    <Link href="/terms" className="text-fuchsia-300 underline underline-offset-2 hover:text-fuchsia-200">
                      Terms
                    </Link>{' '}
                    and{' '}
                    <Link href="/privacy" className="text-fuchsia-300 underline underline-offset-2 hover:text-fuchsia-200">
                      Privacy Policy
                    </Link>
                    .
                  </p>

                  {/* Marketing consent — deliberately small, secondary preference. */}
                  <div className="mt-3 flex items-start gap-2.5 rounded-lg border border-purple-400/10 bg-white/[0.02] px-3 py-2.5">
                    <Checkbox
                      id="marketing-opt-in"
                      checked={marketingOptIn}
                      onCheckedChange={(v) => setMarketingOptIn(v === true)}
                      className="mt-0.5"
                    />
                    <Label
                      htmlFor="marketing-opt-in"
                      className="text-xs font-normal leading-relaxed text-purple-300/70"
                    >
                      {MARKETING_CONSENT_LABEL}
                    </Label>
                  </div>

                  {error && (
                    <p className="mt-4 rounded-lg border border-pink-500/30 bg-pink-500/10 px-3 py-2 text-sm text-pink-300">
                      {error}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Navigation row */}
            <div className="mt-6 flex items-center gap-3">
              {step > 1 && (
                <button
                  type="button"
                  onClick={goBack}
                  disabled={isLoading}
                  className="flex h-12 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-purple-400/20 px-4 text-sm font-semibold text-purple-200 transition-colors hover:bg-white/5 disabled:opacity-50"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  Back
                </button>
              )}

              {step < TOTAL_STEPS ? (
                <button
                  type="button"
                  onClick={goNext}
                  className="group flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 via-purple-600 to-fuchsia-600 text-base font-bold tracking-wide text-white shadow-[0_0_22px_rgba(217,70,239,0.4)] ring-1 ring-fuchsia-300/40 transition-[transform,box-shadow] duration-150 hover:shadow-[0_0_30px_rgba(217,70,239,0.6)] active:scale-[0.985]"
                >
                  Continue
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={isLoading}
                  className="group flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 via-purple-600 to-fuchsia-600 text-base font-bold tracking-wide text-white shadow-[0_0_24px_rgba(217,70,239,0.45)] ring-1 ring-fuchsia-300/40 transition-[transform,box-shadow] duration-150 hover:shadow-[0_0_34px_rgba(217,70,239,0.65)] active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isLoading ? 'Creating account…' : 'Create my account'}
                  {!isLoading && (
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                  )}
                </button>
              )}
            </div>
          </form>

          {/* Single, subtle reassurance line. */}
          <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-purple-300/60">
            <Lock className="h-3.5 w-3.5" aria-hidden="true" />
            Safe &amp; secure — your details are protected
          </p>
        </div>

        <p className="mt-5 text-center text-sm text-purple-200/70">
          Already have an account?{' '}
          <Link href="/auth/login" className="font-semibold text-fuchsia-300 underline-offset-4 hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  )
}

/** Subtle WTF-brand background: deep purple radial glow + faint magenta lighting. */
function WizardBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(112,0,190,0.28),transparent_55%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_20%,rgba(217,70,239,0.14),transparent_45%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_90%,rgba(246,185,26,0.08),transparent_45%)]" />
    </div>
  )
}

function BrandLogo() {
  return (
    <Image
      src="/images/wtf-logo-main.png"
      alt="WTF Giveaways"
      width={160}
      height={57}
      priority
      className="h-auto w-[150px] [filter:drop-shadow(0_0_8px_rgba(168,82,255,0.35))]"
    />
  )
}

function StepHeader({ index, title, subtitle }: { index: number; title: string; subtitle: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-fuchsia-300/80">
        {index} of {TOTAL_STEPS}
      </p>
      <h2 className="mt-1.5 text-balance text-xl font-extrabold text-white sm:text-2xl">{title}</h2>
      <p className="mt-1 text-sm leading-relaxed text-purple-200/70">{subtitle}</p>
    </div>
  )
}

/** Minimal segmented progress: gold = done, magenta glow = current, muted = upcoming. */
function StepProgress({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-1.5" role="progressbar" aria-valuemin={1} aria-valuemax={TOTAL_STEPS} aria-valuenow={step} aria-label={`Step ${step} of ${TOTAL_STEPS}`}>
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => {
        const n = i + 1
        const done = n < step
        const current = n === step
        return (
          <div key={n} className="flex flex-1 items-center gap-1.5">
            <span
              className={
                done
                  ? 'h-2.5 w-2.5 shrink-0 rounded-full bg-[#F6B91A] shadow-[0_0_8px_rgba(246,185,26,0.6)]'
                  : current
                    ? 'h-2.5 w-2.5 shrink-0 rounded-full bg-fuchsia-400 shadow-[0_0_10px_rgba(217,70,239,0.8)]'
                    : 'h-2.5 w-2.5 shrink-0 rounded-full bg-purple-400/25'
              }
            />
            {n < TOTAL_STEPS && (
              <span
                className={`h-px flex-1 rounded-full transition-colors ${
                  done ? 'bg-[#F6B91A]/60' : 'bg-purple-400/15'
                }`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-purple-300/60">{label}</dt>
      <dd className="truncate text-right font-medium text-white">{value}</dd>
    </div>
  )
}
