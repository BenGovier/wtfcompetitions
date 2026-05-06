'use client'

import { useState } from 'react'
import { CheckCircle, ShieldAlert } from 'lucide-react'

interface FieldErrors {
  enquiry_type?: string
  full_name?: string
  email?: string
  message?: string
  preferred_payout_method?: string
  payout_account_holder_name?: string
  payout_sort_code?: string
  payout_account_number?: string
  payout_paypal_email?: string
  payout_contact_detail?: string
}

const ENQUIRY_TYPES = [
  { value: 'general', label: 'General enquiry' },
  { value: 'winner_payout', label: 'Winner payout details' },
  { value: 'ticket_order_problem', label: 'Problem with tickets/order' },
  { value: 'account_login_issue', label: 'Account/login issue' },
  { value: 'other', label: 'Other' },
] as const

const PAYOUT_METHODS = [
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'paypal', label: 'PayPal' },
  { value: 'other', label: 'Other' },
] as const

export function ContactForm() {
  const [form, setForm] = useState({
    enquiry_type: '',
    full_name: '',
    email: '',
    phone: '',
    giveaway_name: '',
    order_reference: '',
    preferred_payout_method: '',
    payout_account_holder_name: '',
    payout_sort_code: '',
    payout_account_number: '',
    payout_paypal_email: '',
    payout_contact_detail: '',
    message: '',
    company_website: '', // honeypot
  })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState('')
  const [success, setSuccess] = useState(false)

  function validate(): FieldErrors {
    const e: FieldErrors = {}
    
    if (!form.enquiry_type) e.enquiry_type = 'Please select an enquiry type'
    if (!form.full_name.trim() || form.full_name.trim().length < 2) e.full_name = 'Please enter your name'
    if (!form.email.trim()) e.email = 'Required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = 'Invalid email'
    if (!form.message.trim() || form.message.trim().length < 10) e.message = 'Please provide more details (min 10 characters)'
    if (form.message.length > 2000) e.message = 'Message too long (max 2000 characters)'

    // Winner payout validation
    if (form.enquiry_type === 'winner_payout') {
      if (!form.preferred_payout_method) e.preferred_payout_method = 'Please select a payout method'
      
      if (form.preferred_payout_method === 'bank_transfer') {
        if (!form.payout_account_holder_name.trim()) e.payout_account_holder_name = 'Required'
        if (!form.payout_sort_code.trim()) e.payout_sort_code = 'Required'
        if (!form.payout_account_number.trim()) e.payout_account_number = 'Required'
      }
      
      if (form.preferred_payout_method === 'paypal') {
        if (!form.payout_paypal_email.trim()) e.payout_paypal_email = 'Required'
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.payout_paypal_email.trim())) e.payout_paypal_email = 'Invalid email'
      }
      
      if (form.preferred_payout_method === 'other') {
        if (!form.payout_contact_detail.trim()) e.payout_contact_detail = 'Please describe your preferred payment method'
      }
    }

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
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        setServerError(json.error || 'Something went wrong')
        return
      }
      setSuccess(true)
    } catch {
      setServerError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  function updateField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  if (success) {
    return (
      <div className="flex flex-col items-center gap-5 py-10 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-500/20">
          <CheckCircle className="h-10 w-10 text-green-400" />
        </div>
        <h3 className="text-2xl font-bold text-white">Message sent</h3>
        <p className="max-w-md text-base text-purple-200/80">
          Thanks — we&apos;ve received your enquiry. If this is about a payout, we&apos;ll verify your details and aim to process payment within 48 hours, often sooner.
        </p>
      </div>
    )
  }

  const inputBase =
    'w-full rounded-xl border border-white/15 bg-white/[0.07] px-4 py-4 text-base text-white placeholder-purple-300/50 outline-none transition-all duration-200 focus:border-[#FFD700]/60 focus:bg-white/[0.1] focus:ring-2 focus:ring-[#FFD700]/20'
  const errorClass = 'mt-1.5 text-xs font-medium text-[#FFD700]'
  const labelClass = 'block text-base font-medium text-purple-100 mb-2'

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {/* Honeypot - hidden from users */}
      <input
        type="text"
        name="company_website"
        value={form.company_website}
        onChange={(e) => updateField('company_website', e.target.value)}
        className="absolute -left-[9999px] h-0 w-0 opacity-0"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
      />

      {/* Enquiry Type */}
      <div>
        <label className={labelClass}>What do you need help with?</label>
        <div className="grid gap-3">
          {ENQUIRY_TYPES.map((type) => (
            <button
              key={type.value}
              type="button"
              onClick={() => {
                updateField('enquiry_type', type.value)
                // Reset payout fields when switching away from winner_payout
                if (type.value !== 'winner_payout') {
                  setForm(prev => ({
                    ...prev,
                    enquiry_type: type.value,
                    preferred_payout_method: '',
                    payout_account_holder_name: '',
                    payout_sort_code: '',
                    payout_account_number: '',
                    payout_paypal_email: '',
                    payout_contact_detail: '',
                  }))
                }
              }}
              className={`w-full rounded-xl border-2 px-5 py-4 text-left text-base font-semibold transition-all ${
                form.enquiry_type === type.value
                  ? 'border-[#FFD700] bg-[#FFD700]/15 text-white shadow-[0_0_20px_rgba(255,215,0,0.15)]'
                  : 'border-purple-500/30 bg-purple-900/20 text-purple-100 hover:border-purple-400/50 hover:bg-purple-900/30'
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>
        {errors.enquiry_type && <p className={errorClass}>{errors.enquiry_type}</p>}
      </div>

      {/* Basic Info */}
      <div>
        <label className={labelClass}>Full name *</label>
        <input
          type="text"
          placeholder="Your full name"
          className={inputBase}
          value={form.full_name}
          onChange={(e) => updateField('full_name', e.target.value)}
        />
        {errors.full_name && <p className={errorClass}>{errors.full_name}</p>}
      </div>

      <div>
        <label className={labelClass}>Email address *</label>
        <input
          type="email"
          placeholder="you@example.com"
          className={inputBase}
          value={form.email}
          onChange={(e) => updateField('email', e.target.value)}
        />
        {errors.email && <p className={errorClass}>{errors.email}</p>}
      </div>

      <div>
        <label className={labelClass}>Phone (optional)</label>
        <input
          type="tel"
          placeholder="Your phone number"
          className={inputBase}
          value={form.phone}
          onChange={(e) => updateField('phone', e.target.value)}
        />
      </div>

      <div>
        <label className={labelClass}>Giveaway name (optional)</label>
        <input
          type="text"
          placeholder="Which giveaway is this about?"
          className={inputBase}
          value={form.giveaway_name}
          onChange={(e) => updateField('giveaway_name', e.target.value)}
        />
      </div>

      <div>
        <label className={labelClass}>Order reference (optional)</label>
        <input
          type="text"
          placeholder="Your order or ticket reference"
          className={inputBase}
          value={form.order_reference}
          onChange={(e) => updateField('order_reference', e.target.value)}
        />
      </div>

      {/* Winner Payout Section - Only shown when enquiry_type is winner_payout */}
      {form.enquiry_type === 'winner_payout' && (
        <div className="rounded-2xl border-2 border-[#FFD700]/30 bg-[#FFD700]/5 p-5 space-y-5">
          <div>
            <h3 className="text-lg font-bold text-white">Payout details</h3>
            <p className="mt-2 text-sm text-purple-200/80">
              Choose how you&apos;d like to be paid. We aim to process verified payouts within 48 hours, often sooner.
            </p>
          </div>

          {/* Safety Warning inside payout panel */}
          <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <p className="text-xs text-amber-200/90">
              Never enter card details, passwords, PINs, CVV numbers, or online banking login details.
            </p>
          </div>

          {/* Payout Method Selection */}
          <div>
            <label className={labelClass}>Preferred payout method</label>
            <div className="grid gap-3">
              {PAYOUT_METHODS.map((method) => (
                <button
                  key={method.value}
                  type="button"
                  onClick={() => {
                    updateField('preferred_payout_method', method.value)
                    // Clear other payout fields
                    setForm(prev => ({
                      ...prev,
                      preferred_payout_method: method.value,
                      payout_account_holder_name: method.value === 'bank_transfer' ? prev.payout_account_holder_name : '',
                      payout_sort_code: method.value === 'bank_transfer' ? prev.payout_sort_code : '',
                      payout_account_number: method.value === 'bank_transfer' ? prev.payout_account_number : '',
                      payout_paypal_email: method.value === 'paypal' ? prev.payout_paypal_email : '',
                      payout_contact_detail: method.value === 'other' ? prev.payout_contact_detail : '',
                    }))
                  }}
                  className={`w-full rounded-xl border-2 px-4 py-3.5 text-left text-base font-semibold transition-all ${
                    form.preferred_payout_method === method.value
                      ? 'border-[#FFD700] bg-[#FFD700]/15 text-white'
                      : 'border-purple-500/30 bg-purple-900/20 text-purple-100 hover:border-purple-400/50'
                  }`}
                >
                  {method.label}
                </button>
              ))}
            </div>
            {errors.preferred_payout_method && <p className={errorClass}>{errors.preferred_payout_method}</p>}
          </div>

          {/* Bank Transfer Fields */}
          {form.preferred_payout_method === 'bank_transfer' && (
            <div className="space-y-4">
              <div>
                <label className={labelClass}>Account holder name *</label>
                <input
                  type="text"
                  placeholder="Name on the bank account"
                  className={inputBase}
                  value={form.payout_account_holder_name}
                  onChange={(e) => updateField('payout_account_holder_name', e.target.value)}
                />
                {errors.payout_account_holder_name && <p className={errorClass}>{errors.payout_account_holder_name}</p>}
              </div>
              <div>
                <label className={labelClass}>Sort code *</label>
                <input
                  type="text"
                  placeholder="00-00-00"
                  className={inputBase}
                  value={form.payout_sort_code}
                  onChange={(e) => updateField('payout_sort_code', e.target.value)}
                />
                {errors.payout_sort_code && <p className={errorClass}>{errors.payout_sort_code}</p>}
              </div>
              <div>
                <label className={labelClass}>Account number *</label>
                <input
                  type="text"
                  placeholder="12345678"
                  className={inputBase}
                  value={form.payout_account_number}
                  onChange={(e) => updateField('payout_account_number', e.target.value)}
                />
                {errors.payout_account_number && <p className={errorClass}>{errors.payout_account_number}</p>}
              </div>
            </div>
          )}

          {/* PayPal Field */}
          {form.preferred_payout_method === 'paypal' && (
            <div>
              <label className={labelClass}>PayPal email address *</label>
              <input
                type="email"
                placeholder="your.paypal@email.com"
                className={inputBase}
                value={form.payout_paypal_email}
                onChange={(e) => updateField('payout_paypal_email', e.target.value)}
              />
              {errors.payout_paypal_email && <p className={errorClass}>{errors.payout_paypal_email}</p>}
            </div>
          )}

          {/* Other Payout Field */}
          {form.preferred_payout_method === 'other' && (
            <div>
              <label className={labelClass}>Payout contact details *</label>
              <input
                type="text"
                placeholder="How should we contact you for payment?"
                className={inputBase}
                value={form.payout_contact_detail}
                onChange={(e) => updateField('payout_contact_detail', e.target.value)}
              />
              {errors.payout_contact_detail && <p className={errorClass}>{errors.payout_contact_detail}</p>}
            </div>
          )}
        </div>
      )}

      {/* Message */}
      <div>
        <label className={labelClass}>Message *</label>
        <textarea
          placeholder="Please describe your enquiry in detail..."
          rows={4}
          className={`${inputBase} resize-none`}
          value={form.message}
          onChange={(e) => updateField('message', e.target.value)}
          maxLength={2000}
        />
        <div className="mt-1.5 flex justify-between">
          {errors.message ? (
            <p className={errorClass}>{errors.message}</p>
          ) : (
            <span />
          )}
          <span className="text-xs text-purple-300/50">{form.message.length}/2000</span>
        </div>
      </div>

      {serverError && (
        <p className="rounded-xl bg-red-500/20 px-4 py-3 text-center text-sm text-red-200">
          {serverError}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="mt-2 w-full overflow-hidden rounded-xl bg-gradient-to-r from-[#FFD700] to-[#FFA500] px-6 py-5 text-base font-bold uppercase tracking-wider text-[#1a0a2e] shadow-lg transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_0_30px_rgba(255,215,0,0.4)] active:scale-[0.98] disabled:opacity-50 disabled:hover:translate-y-0"
      >
        {submitting ? 'Sending...' : 'Send Message'}
      </button>
    </form>
  )
}
