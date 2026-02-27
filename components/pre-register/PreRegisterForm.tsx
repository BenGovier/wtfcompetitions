'use client'

import { useState } from 'react'
import Link from 'next/link'

interface FieldErrors {
  first_name?: string
  last_name?: string
  tiktok_nickname?: string
  mobile?: string
  email?: string
  consent?: string
}

export function PreRegisterForm() {
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    tiktok_nickname: '',
    mobile: '',
    email: '',
    consent: false,
  })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState('')
  const [success, setSuccess] = useState<null | { alreadyRegistered: boolean }>(null)

  function validate(): FieldErrors {
    const e: FieldErrors = {}
    if (!form.first_name.trim()) e.first_name = 'Required'
    if (!form.last_name.trim()) e.last_name = 'Required'
    if (!form.tiktok_nickname.trim()) e.tiktok_nickname = 'Required'
    if (!form.mobile.trim()) e.mobile = 'Required'
    else if (!/^\d{11}$/.test(form.mobile.trim())) e.mobile = 'Must be exactly 11 digits'
    if (!form.email.trim()) e.email = 'Required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = 'Invalid email'
    if (!form.consent) e.consent = 'You must agree to continue'
    return e
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    setServerError('')
    const fieldErrors = validate()
    setErrors(fieldErrors)
    if (Object.keys(fieldErrors).length > 0) return

    setSubmitting(true)
    try {
      const res = await fetch('/api/pre-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        setServerError(json.error || 'Something went wrong')
        return
      }
      setSuccess({ alreadyRegistered: !!json.alreadyRegistered })
    } catch {
      setServerError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  function updateField(field: string, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  if (success) {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <div className="text-4xl">&#10024;</div>
        <h3 className="text-2xl font-bold text-white">
          {success.alreadyRegistered
            ? "You're already on the list"
            : "You're in!"}
        </h3>
        <p className="text-lg text-pink-100">
          {success.alreadyRegistered
            ? "We already have your details. Stay tuned!"
            : "We'll notify you when it drops."}
        </p>
      </div>
    )
  }

  const inputBase =
    'w-full rounded-lg border border-pink-300/40 bg-white/10 px-4 py-3 text-white placeholder-pink-200/60 backdrop-blur-sm outline-none transition focus:border-[#FFD700] focus:ring-2 focus:ring-[#FFD700]/30 text-sm'
  const errorClass = 'mt-1 text-xs text-[#FFD700]'

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <input
            type="text"
            placeholder="First Name"
            className={inputBase}
            value={form.first_name}
            onChange={(e) => updateField('first_name', e.target.value)}
            aria-label="First Name"
          />
          {errors.first_name && <p className={errorClass}>{errors.first_name}</p>}
        </div>
        <div>
          <input
            type="text"
            placeholder="Last Name"
            className={inputBase}
            value={form.last_name}
            onChange={(e) => updateField('last_name', e.target.value)}
            aria-label="Last Name"
          />
          {errors.last_name && <p className={errorClass}>{errors.last_name}</p>}
        </div>
      </div>

      <div>
        <input
          type="text"
          placeholder="TikTok Nickname"
          className={inputBase}
          value={form.tiktok_nickname}
          onChange={(e) => updateField('tiktok_nickname', e.target.value)}
          aria-label="TikTok Nickname"
        />
        {errors.tiktok_nickname && <p className={errorClass}>{errors.tiktok_nickname}</p>}
      </div>

      <div>
        <input
          type="tel"
          placeholder="Mobile (11 digits)"
          className={inputBase}
          value={form.mobile}
          onChange={(e) => updateField('mobile', e.target.value)}
          aria-label="Mobile Number"
        />
        {errors.mobile && <p className={errorClass}>{errors.mobile}</p>}
      </div>

      <div>
        <input
          type="email"
          placeholder="Email Address"
          className={inputBase}
          value={form.email}
          onChange={(e) => updateField('email', e.target.value)}
          aria-label="Email Address"
        />
        {errors.email && <p className={errorClass}>{errors.email}</p>}
      </div>

      <div>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 shrink-0 accent-[#FFD700]"
            checked={form.consent}
            onChange={(e) => updateField('consent', e.target.checked)}
          />
          <span className="text-xs leading-relaxed text-pink-100">
            {'I agree to the '}
            <Link href="/legal/terms" className="underline hover:text-white">
              Terms & Conditions
            </Link>
            {' and '}
            <Link href="/legal/privacy" className="underline hover:text-white">
              Privacy Policy
            </Link>
            {' and I consent to marketing.'}
          </span>
        </label>
        {errors.consent && <p className={errorClass}>{errors.consent}</p>}
      </div>

      {serverError && (
        <p className="rounded-lg bg-red-500/20 px-4 py-2 text-center text-sm text-red-200">
          {serverError}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="relative w-full rounded-xl bg-gradient-to-r from-[#FFD700] to-[#FFA500] px-6 py-4 text-base font-extrabold uppercase tracking-wider text-[#1a0a2e] shadow-lg transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_0_30px_rgba(255,215,0,0.4)] disabled:opacity-50 disabled:hover:translate-y-0"
      >
        {submitting ? 'Registering...' : 'Pre-Register Now'}
      </button>

      <p className="text-center text-[11px] text-pink-200/60">
        UK only &bull; 18+ &bull; No spam
      </p>
    </form>
  )
}
