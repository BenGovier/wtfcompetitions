import Image from 'next/image'
import { PreRegisterForm } from '@/components/pre-register/PreRegisterForm'

export const metadata = {
  title: 'WIN The Ultimate Kit - WTF Giveaways LIVE',
  description: 'Choleigh is LIVE — join the free VIP drop list and win the £59.99 What The Collection Ultimate Kit.',
}

export default function PreRegisterPage() {
  return (
    <>
      {/* Hide root layout header/footer/nav */}
      <style>{`
        header, footer, nav[aria-label], .announcement-bar, .mobile-nav-bar {
          display: none !important;
        }
        main { min-height: 100vh !important; padding: 0 !important; margin: 0 !important; }

        @keyframes float-heart {
          0% { opacity: 1; transform: translateY(0) scale(1); }
          50% { opacity: 0.8; transform: translateY(-120px) scale(1.1) translateX(-8px); }
          100% { opacity: 0; transform: translateY(-260px) scale(0.6) translateX(12px); }
        }
        @keyframes pulse-live {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes chat-scroll {
          0% { transform: translateY(100%); opacity: 0; }
          10% { opacity: 1; }
          85% { opacity: 1; }
          100% { transform: translateY(-100%); opacity: 0; }
        }
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes glow-pulse {
          0%, 100% { box-shadow: 0 0 30px rgba(255,0,100,0.3), 0 0 60px rgba(255,0,100,0.1); }
          50% { box-shadow: 0 0 50px rgba(255,0,100,0.5), 0 0 100px rgba(255,0,100,0.2); }
        }
      `}</style>

      <div className="relative min-h-screen overflow-hidden" style={{
        background: 'linear-gradient(160deg, #0a0a0a 0%, #1a0011 20%, #3d0025 45%, #8b0040 70%, #d4004a 100%)',
      }}>
        {/* Bloom glow overlays */}
        <div className="pointer-events-none absolute inset-0 z-0" aria-hidden="true">
          <div className="absolute top-0 left-1/4 h-[500px] w-[500px] rounded-full" style={{
            background: 'radial-gradient(circle, rgba(255,0,100,0.2) 0%, transparent 70%)',
            filter: 'blur(80px)',
          }} />
          <div className="absolute bottom-0 right-0 h-[400px] w-[400px] rounded-full" style={{
            background: 'radial-gradient(circle, rgba(255,215,0,0.12) 0%, transparent 70%)',
            filter: 'blur(60px)',
          }} />
          <div className="absolute top-1/3 right-1/4 h-[300px] w-[300px] rounded-full" style={{
            background: 'radial-gradient(circle, rgba(255,0,150,0.15) 0%, transparent 70%)',
            filter: 'blur(100px)',
          }} />
        </div>

        {/* Sparkle overlay */}
        <div className="pointer-events-none absolute inset-0 z-[1]" style={{
          backgroundImage:
            'radial-gradient(1px 1px at 10% 20%, rgba(255,215,0,0.7) 0%, transparent 100%), ' +
            'radial-gradient(1.5px 1.5px at 25% 70%, rgba(255,255,255,0.5) 0%, transparent 100%), ' +
            'radial-gradient(1px 1px at 45% 15%, rgba(255,215,0,0.5) 0%, transparent 100%), ' +
            'radial-gradient(1px 1px at 60% 55%, rgba(255,255,255,0.4) 0%, transparent 100%), ' +
            'radial-gradient(1.5px 1.5px at 75% 30%, rgba(255,215,0,0.6) 0%, transparent 100%), ' +
            'radial-gradient(1px 1px at 85% 75%, rgba(255,255,255,0.3) 0%, transparent 100%), ' +
            'radial-gradient(1px 1px at 15% 90%, rgba(255,215,0,0.4) 0%, transparent 100%), ' +
            'radial-gradient(1.5px 1.5px at 50% 45%, rgba(255,255,255,0.5) 0%, transparent 100%)',
        }} aria-hidden="true" />

        {/* ===== LIVE UI OVERLAY ===== */}

        {/* Top-left LIVE pill */}
        <div className="absolute top-4 left-4 z-30 flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-full bg-red-600 px-3 py-1 shadow-lg">
            <span className="inline-block h-2 w-2 rounded-full bg-white" style={{ animation: 'pulse-live 1.2s ease-in-out infinite' }} />
            <span className="text-xs font-bold uppercase tracking-wider text-white">LIVE</span>
          </div>
        </div>

        {/* Right side floating hearts */}
        <div className="pointer-events-none absolute right-4 bottom-40 z-30 flex flex-col items-center gap-1 md:right-8 md:bottom-60" aria-hidden="true">
          {['#ff2d55', '#ff6b8a', '#FFD700', '#ff4081', '#ff9ec4', '#FFD700', '#ff2d55', '#ff6b8a'].map((color, i) => (
            <span key={i} className="text-lg" style={{
              color,
              animation: `float-heart ${2.5 + (i * 0.4)}s ease-out ${i * 0.6}s infinite`,
              opacity: 0,
            }}>
              {i % 3 === 0 ? '\u2764\uFE0F' : i % 3 === 1 ? '\uD83D\uDC96' : '\u2728'}
            </span>
          ))}
        </div>

        {/* Bottom chat overlay */}
        <div className="pointer-events-none absolute bottom-20 left-4 z-20 flex w-64 flex-col gap-1 overflow-hidden md:bottom-8 md:w-72" style={{ height: '140px' }} aria-hidden="true">
          {[
            'joined the VIP list \uD83D\uDD25',
            'OMG need this',
            'entered \u2705',
            "Choleigh you're unreal",
            'done! \uD83D\uDC96',
            'where do i sign up??',
            'this kit is everything \u2728',
            'just registered!!! \uD83D\uDE0D',
          ].map((msg, i) => (
            <div key={i} className="whitespace-nowrap rounded-full bg-black/40 px-3 py-1 text-xs text-white/80 backdrop-blur-sm" style={{
              animation: `chat-scroll ${6}s linear ${i * 2.2}s infinite`,
              opacity: 0,
            }}>
              {msg}
            </div>
          ))}
        </div>

        {/* ===== MOBILE LAYOUT ===== */}
        <div className="relative z-10 flex min-h-screen flex-col lg:hidden">
          {/* Choleigh hero - top half */}
          <div className="relative flex h-[55vh] min-h-[360px] items-end justify-center overflow-hidden">
            <div className="absolute inset-0" style={{
              background: 'linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.8) 100%)',
            }} />
            <Image
              src="/images/pre-register-choleigh.png"
              alt="Choleigh - WTF Giveaways"
              fill
              className="object-contain object-bottom"
              priority
              sizes="100vw"
            />
            {/* Headline overlaid on image */}
            <div className="relative z-10 px-6 pb-6 text-center">
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-pink-300/80">WTF Giveaways</p>
              <h1 className="mt-2 text-3xl font-black uppercase leading-none tracking-tight text-white sm:text-4xl">
                {'Win the '}
                <span className="bg-gradient-to-r from-[#FFD700] via-[#FFC400] to-[#FFA500] bg-clip-text text-transparent" style={{
                  backgroundSize: '200% auto',
                  animation: 'shimmer 3s linear infinite',
                }}>{'£59.99'}</span>
              </h1>
              <h2 className="mt-1 text-xl font-extrabold uppercase tracking-wide text-white sm:text-2xl">
                What The Collection
              </h2>
              <p className="text-lg font-bold uppercase text-[#FFD700]">Ultimate Kit</p>
              <p className="mt-2 text-sm text-pink-200/70">
                {"Choleigh is LIVE on TikTok \u2014 join the free VIP drop list."}
              </p>
            </div>
          </div>

          {/* Tap to join CTA */}
          <div className="relative z-10 -mt-3 text-center">
            <a href="#form-card" className="inline-flex items-center gap-1 rounded-full bg-white/10 px-4 py-1.5 text-xs font-medium text-pink-200 backdrop-blur-sm transition hover:bg-white/20">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#FFD700]" style={{ animation: 'pulse-live 1.5s ease-in-out infinite' }} />
              Tap to join the VIP list
            </a>
          </div>

          {/* Form card */}
          <div id="form-card" className="relative z-10 flex flex-1 flex-col px-4 pb-24 pt-4">
            <div className="mx-auto w-full max-w-md rounded-2xl border border-white/10 p-5 shadow-2xl backdrop-blur-md" style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 100%)',
              animation: 'glow-pulse 4s ease-in-out infinite',
            }}>
              <h3 className="mb-1 text-center text-lg font-bold uppercase tracking-wide text-white">Secure your spot</h3>
              <p className="mb-4 text-center text-xs text-pink-200/60">Be the first to know when it drops</p>
              <PreRegisterForm />
            </div>
          </div>
        </div>

        {/* ===== DESKTOP LAYOUT ===== */}
        <div className="relative z-10 mx-auto hidden min-h-screen max-w-7xl items-center gap-8 px-8 py-12 lg:flex xl:gap-16">
          {/* Left: Choleigh */}
          <div className="relative flex w-1/2 items-end justify-center" style={{ height: '85vh', maxHeight: '800px' }}>
            <div className="relative h-full w-full max-w-[500px]">
              <Image
                src="/images/pre-register-choleigh.png"
                alt="Choleigh - WTF Giveaways"
                fill
                className="object-contain object-bottom drop-shadow-[0_0_40px_rgba(255,0,100,0.3)]"
                priority
                sizes="50vw"
              />
              {/* Rim glow */}
              <div className="pointer-events-none absolute inset-0 rounded-full" style={{
                background: 'radial-gradient(ellipse at 50% 80%, rgba(255,0,100,0.15) 0%, transparent 60%)',
              }} aria-hidden="true" />
            </div>
          </div>

          {/* Right: Content + Form */}
          <div className="flex w-1/2 flex-col items-start">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-pink-300/80">WTF Giveaways</p>
            <h1 className="mt-4 text-5xl font-black uppercase leading-none tracking-tight text-white xl:text-6xl">
              {'Win the '}
              <span className="bg-gradient-to-r from-[#FFD700] via-[#FFC400] to-[#FFA500] bg-clip-text text-transparent" style={{
                backgroundSize: '200% auto',
                animation: 'shimmer 3s linear infinite',
              }}>{'£59.99'}</span>
            </h1>
            <h2 className="mt-2 text-3xl font-extrabold uppercase tracking-wide text-white xl:text-4xl">
              What The Collection
            </h2>
            <p className="text-2xl font-bold uppercase text-[#FFD700] xl:text-3xl">Ultimate Kit</p>
            <p className="mt-3 max-w-md text-base leading-relaxed text-pink-200/70">
              {"Choleigh is LIVE on TikTok \u2014 join the free VIP drop list."}
            </p>

            {/* Tap to join */}
            <div className="mt-4">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-pink-200 backdrop-blur-sm">
                <span className="inline-block h-2 w-2 rounded-full bg-[#FFD700]" style={{ animation: 'pulse-live 1.5s ease-in-out infinite' }} />
                Tap to join the VIP list
              </span>
            </div>

            {/* Form card */}
            <div className="mt-8 w-full max-w-md rounded-2xl border border-white/10 p-6 shadow-2xl backdrop-blur-md xl:p-8" style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 100%)',
              animation: 'glow-pulse 4s ease-in-out infinite',
            }}>
              <h3 className="mb-1 text-center text-xl font-bold uppercase tracking-wide text-white">Secure your spot</h3>
              <p className="mb-5 text-center text-sm text-pink-200/60">Be the first to know when it drops</p>
              <PreRegisterForm />
            </div>
          </div>
        </div>

        {/* ===== MOBILE STICKY CTA BAR ===== */}
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-black/80 p-3 backdrop-blur-md lg:hidden">
          <a
            href="#form-card"
            className="block w-full rounded-xl bg-gradient-to-r from-[#FFD700] to-[#FFA500] px-6 py-3.5 text-center text-base font-extrabold uppercase tracking-wider text-[#1a0a2e] shadow-lg transition-all active:scale-[0.98]"
            style={{ backgroundSize: '200% auto', animation: 'shimmer 3s linear infinite' }}
          >
            JOIN FREE VIP LIST
          </a>
        </div>
      </div>
    </>
  )
}
