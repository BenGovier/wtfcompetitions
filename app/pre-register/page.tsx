import Image from 'next/image'
import { PreRegisterForm } from '@/components/pre-register/PreRegisterForm'

export default function PreRegisterPage() {
  return (
    <>
      {/* Hide root layout header/footer/nav for this standalone page */}
      <style>{`
        header, footer, nav[aria-label], .announcement-bar, .mobile-nav-bar {
          display: none !important;
        }
        main {
          min-height: 100vh !important;
          padding: 0 !important;
          margin: 0 !important;
        }
      `}</style>

      <div
        className="relative flex min-h-screen flex-col items-center overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #1a0a2e 0%, #3d0f5c 25%, #8b1a6d 50%, #c2185b 75%, #e91e63 100%)',
        }}
      >
        {/* Sparkle overlay */}
        <div
          className="pointer-events-none absolute inset-0 z-0"
          style={{
            backgroundImage:
              'radial-gradient(1px 1px at 10% 20%, rgba(255,215,0,0.6) 0%, transparent 100%), ' +
              'radial-gradient(1px 1px at 30% 60%, rgba(255,215,0,0.4) 0%, transparent 100%), ' +
              'radial-gradient(1.5px 1.5px at 50% 10%, rgba(255,255,255,0.5) 0%, transparent 100%), ' +
              'radial-gradient(1px 1px at 70% 40%, rgba(255,215,0,0.5) 0%, transparent 100%), ' +
              'radial-gradient(1px 1px at 90% 80%, rgba(255,255,255,0.4) 0%, transparent 100%), ' +
              'radial-gradient(1.5px 1.5px at 20% 90%, rgba(255,215,0,0.3) 0%, transparent 100%), ' +
              'radial-gradient(1px 1px at 60% 75%, rgba(255,255,255,0.3) 0%, transparent 100%), ' +
              'radial-gradient(1px 1px at 80% 15%, rgba(255,215,0,0.4) 0%, transparent 100%), ' +
              'radial-gradient(1.5px 1.5px at 40% 45%, rgba(255,255,255,0.4) 0%, transparent 100%), ' +
              'radial-gradient(1px 1px at 15% 55%, rgba(255,215,0,0.5) 0%, transparent 100%)',
          }}
          aria-hidden="true"
        />

        {/* Gold glow top accent */}
        <div
          className="pointer-events-none absolute top-0 left-1/2 z-0 h-64 w-[600px] -translate-x-1/2"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(255,215,0,0.12) 0%, transparent 70%)',
          }}
          aria-hidden="true"
        />

        {/* Content */}
        <div className="relative z-10 flex w-full max-w-6xl flex-col px-4 py-8 md:py-12">
          {/* Brand text */}
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-pink-200/70">
            WTF Giveaways
          </p>

          {/* Headline */}
          <div className="mt-6 md:mt-10">
            <h1 className="text-balance text-3xl font-extrabold uppercase leading-tight tracking-tight text-white sm:text-4xl md:text-5xl lg:text-6xl">
              {'Win the '}
              <span className="bg-gradient-to-r from-[#FFD700] to-[#FFA500] bg-clip-text text-transparent">
                {'£59.99'}
              </span>
              {' What The Collection'}
            </h1>
            <p className="mt-1 text-xl font-bold uppercase tracking-wide text-pink-100/80 sm:text-2xl md:text-3xl">
              The Ultimate Kit
            </p>
            <p className="mt-3 max-w-lg text-base leading-relaxed text-pink-100/70 md:text-lg">
              Pre-register now for early access + exclusive drops.
            </p>
          </div>

          {/* Two-column layout */}
          <div className="mt-8 flex flex-col items-center gap-8 lg:mt-12 lg:flex-row lg:items-start lg:gap-12">
            {/* Left: Images */}
            <div className="flex w-full shrink-0 flex-col items-center gap-6 sm:flex-row sm:justify-center lg:w-1/2 lg:justify-start">
              {/* Choleigh image */}
              <div className="relative h-[320px] w-[240px] overflow-hidden rounded-2xl border-2 border-[#FFD700]/30 shadow-[0_0_40px_rgba(255,215,0,0.15)] sm:h-[380px] sm:w-[280px]">
                <Image
                  src="/images/pre-register-choleigh.png"
                  alt="Choleigh - WTF Giveaways"
                  fill
                  className="object-cover object-top"
                  priority
                  sizes="(max-width: 640px) 240px, 280px"
                />
              </div>

              {/* Product image */}
              <div className="relative h-[280px] w-[240px] overflow-hidden rounded-2xl border-2 border-[#FFD700]/30 shadow-[0_0_40px_rgba(255,215,0,0.15)] sm:h-[320px] sm:w-[260px]">
                <Image
                  src="/images/pre-register-product.png"
                  alt="What The Collection - The Ultimate Kit"
                  fill
                  className="object-contain"
                  priority
                  sizes="(max-width: 640px) 240px, 260px"
                />
              </div>
            </div>

            {/* Right: Form card */}
            <div className="w-full max-w-md lg:w-1/2">
              <div
                className="rounded-2xl border border-white/10 p-6 shadow-2xl backdrop-blur-md md:p-8"
                style={{
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)',
                }}
              >
                <h2 className="mb-1 text-center text-xl font-bold uppercase tracking-wide text-white">
                  Secure your spot
                </h2>
                <p className="mb-6 text-center text-sm text-pink-200/60">
                  Be the first to know when it drops
                </p>
                <PreRegisterForm />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
