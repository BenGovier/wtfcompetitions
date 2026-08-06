/**
 * DG'S BIG BALLERS — scoped stylesheet for the isolated /dgfootballidea route.
 * Everything is namespaced under `.dgf-page`. Uses the exact brand palette as
 * local CSS variables. No global tokens are modified. Prototype only.
 */

export const DG_FOOTBALL_CSS = String.raw`
.dgf-page {
  --dg-black: #050705;
  --dg-charcoal: #0C100D;
  --dg-panel: #111712;
  --dg-neon: #A8FF19;
  --dg-neon2: #5DFF00;
  --dg-glow: rgba(168, 255, 25, 0.35);
  --dg-white: #F7F7F2;
  --dg-muted: #A7B0A4;
  --dg-gold: #FFD84A;
  --dg-cash: #7CFF67;
  --dg-font: var(--font-sans, ui-sans-serif, system-ui, sans-serif);

  position: fixed;
  inset: 0;
  z-index: 100;
  height: 100dvh;
  min-height: 100dvh;
  width: 100%;
  overflow: hidden;
  background: var(--dg-black);
  color: var(--dg-white);
  font-family: var(--dg-font);
  -webkit-font-smoothing: antialiased;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}
.dgf-page *,
.dgf-page *::before,
.dgf-page *::after { box-sizing: border-box; }

.dgf-desktop-bg {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(1200px 600px at 50% -10%, rgba(168,255,25,0.08), transparent 60%),
    radial-gradient(800px 800px at 50% 120%, rgba(93,255,0,0.06), transparent 60%),
    var(--dg-black);
}

.dgf-layout {
  position: relative;
  z-index: 1;
  height: 100%;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 28px;
}

/* -------------------------------------------------------------------------- */
/*  Portrait viewport                                                         */
/* -------------------------------------------------------------------------- */
.dgf-viewport {
  position: relative;
  width: 100%;
  height: 100dvh;
  overflow: hidden;
  background: var(--dg-black);
}
@media (min-width: 900px) {
  .dgf-viewport {
    width: min(460px, 42vw);
    height: min(920px, 94dvh);
    aspect-ratio: 390 / 844;
    border-radius: 30px;
    border: 1px solid rgba(168,255,25,0.16);
    box-shadow: 0 40px 120px rgba(0,0,0,0.75), 0 0 0 10px rgba(255,255,255,0.02);
  }
}

.dgf-reveal-root {
  position: absolute;
  inset: 0;
  height: 100%;
  overflow: hidden;
}
.dgf-stage { position: absolute; inset: 0; }

.dgf-stage {
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
  isolation: isolate;
}
.dgf-shake { animation: dgf-shake 220ms ease-in-out; }
@keyframes dgf-shake {
  0%,100% { transform: translate(0,0); }
  20% { transform: translate(-4px, 3px); }
  40% { transform: translate(4px, -3px); }
  60% { transform: translate(-3px, -2px); }
  80% { transform: translate(3px, 2px); }
}

/* -------------------------------------------------------------------------- */
/*  Stadium environment                                                       */
/* -------------------------------------------------------------------------- */
.dgf-env { position: absolute; inset: 0; z-index: 0; overflow: hidden; pointer-events: none; }
.dgf-floodlights {
  position: absolute; inset: 0;
  background:
    linear-gradient(180deg, rgba(168,255,25,0.05), transparent 22%),
    repeating-linear-gradient(90deg, transparent 0 60px, rgba(255,255,255,0.015) 60px 61px);
  opacity: 0.7;
}
.dgf-dg-glow {
  position: absolute;
  left: 50%; top: 40%;
  width: 82%; height: 46%;
  transform: translate(-50%, -50%);
  background: radial-gradient(circle, var(--dg-glow), transparent 68%);
  filter: blur(6px);
  animation: dgf-glow-pulse 4.5s ease-in-out infinite;
}
@keyframes dgf-glow-pulse {
  0%,100% { opacity: 0.55; transform: translate(-50%, -50%) scale(1); }
  50% { opacity: 0.8; transform: translate(-50%, -50%) scale(1.05); }
}
.dgf-pitch {
  position: absolute; left: 0; right: 0; bottom: 0; height: 34%;
  background:
    linear-gradient(180deg, transparent, rgba(168,255,25,0.05) 40%, rgba(5,7,5,0.9)),
    repeating-linear-gradient(180deg, transparent 0 22px, rgba(168,255,25,0.05) 22px 23px);
  transform: perspective(320px) rotateX(58deg);
  transform-origin: bottom center;
  opacity: 0.6;
}
.dgf-pitch::after {
  content: "";
  position: absolute; left: 50%; bottom: 6%;
  width: 46%; height: 60%;
  transform: translateX(-50%);
  border: 1px solid rgba(168,255,25,0.16);
  border-bottom: none;
  border-radius: 50% 50% 0 0 / 40% 40% 0 0;
}
.dgf-grain {
  position: absolute; inset: 0; opacity: 0.05; mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='120' height='120' filter='url(%23n)'/></svg>");
}
.dgf-particles { position: absolute; inset: 0; pointer-events: none; }
.dgf-particle {
  position: absolute;
  width: 3px; height: 3px; border-radius: 50%;
  background: var(--dg-neon);
  box-shadow: 0 0 6px var(--dg-neon);
  opacity: 0.5;
  bottom: -10px;
  animation: dgf-float linear infinite;
}
.dgf-particle:nth-child(1){ left: 12%; } .dgf-particle:nth-child(2){ left: 26%; }
.dgf-particle:nth-child(3){ left: 38%; } .dgf-particle:nth-child(4){ left: 47%; }
.dgf-particle:nth-child(5){ left: 55%; } .dgf-particle:nth-child(6){ left: 63%; }
.dgf-particle:nth-child(7){ left: 71%; } .dgf-particle:nth-child(8){ left: 80%; }
.dgf-particle:nth-child(9){ left: 88%; } .dgf-particle:nth-child(10){ left: 94%; }
@keyframes dgf-float {
  0% { transform: translateY(0); opacity: 0; }
  15% { opacity: 0.6; }
  100% { transform: translateY(-105vh); opacity: 0; }
}
.dgf-vignette {
  position: absolute; inset: 0;
  box-shadow: inset 0 0 120px 30px rgba(0,0,0,0.9);
  pointer-events: none;
}

/* -------------------------------------------------------------------------- */
/*  Brand bar                                                                 */
/* -------------------------------------------------------------------------- */
.dgf-brand {
  position: absolute; top: 0; left: 0; right: 0; z-index: 5;
  max-height: 14%;
  padding: calc(env(safe-area-inset-top) + 10px) 16px 6px;
  text-align: center;
  pointer-events: none;
}
.dgf-brand-titles { display: flex; flex-direction: column; line-height: 0.82; }
.dgf-brand-1, .dgf-brand-2 {
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.01em;
  transform: scaleY(1.12);
  transform-origin: top center;
}
.dgf-brand-1 { color: var(--dg-neon); font-size: clamp(20px, 6.6vw, 30px); text-shadow: 0 0 18px var(--dg-glow); }
.dgf-brand-2 { color: var(--dg-white); font-size: clamp(26px, 9vw, 42px); }
.dgf-brand-sub {
  margin-top: 8px; color: var(--dg-muted);
  font-size: clamp(9px, 2.8vw, 11px); font-weight: 700;
  letter-spacing: 0.32em; text-transform: uppercase;
}
.dgf-progress {
  margin-top: 4px; color: var(--dg-neon);
  font-size: 10px; font-weight: 800; letter-spacing: 0.28em;
}

/* -------------------------------------------------------------------------- */
/*  Character                                                                 */
/* -------------------------------------------------------------------------- */
.dgf-character-area {
  position: absolute; inset: 0; z-index: 1;
  transition: opacity 260ms ease, filter 260ms ease;
  pointer-events: none;
}
/* Keep DG clearly visible behind the risen result panel — dim, never hidden. */
.dgf-character-area.dgf-dim { opacity: 0.82; filter: saturate(0.85) brightness(0.82); }

.dgf-character { position: absolute; left: 0; right: 0; top: 9%; height: 68%; }
.dgf-rim {
  position: absolute; left: 50%; top: 52%;
  width: 82%; height: 66%;
  transform: translate(-50%, -50%);
  background:
    radial-gradient(60% 70% at 50% 42%, rgba(168,255,25,0.30), transparent 66%),
    radial-gradient(closest-side, rgba(93,255,0,0.10), transparent 72%);
  filter: blur(14px);
}
.dgf-character-inner { position: absolute; inset: 0; }
.dgf-breathe { animation: dgf-breathe 6s ease-in-out infinite; transform-origin: bottom center; }
@keyframes dgf-breathe {
  0%,100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-0.6%) scale(1.012); }
}
.dgf-dg-img {
  position: absolute; inset: 0;
  width: 100%; height: 100%;
  object-fit: contain;
  /* Keep DG's head, hands and boots in frame; he is the focal point. */
  object-position: center top;
  transition-property: opacity;
  transition-timing-function: ease;
  pointer-events: none;
  /* The supplied portraits sit on a bright studio backdrop. Feather the
     rectangular edges into the stadium so DG reads as spotlit on the pitch,
     not pasted into a hard photo box. Elliptical + bottom fade, no cropping. */
  -webkit-mask-image:
    radial-gradient(72% 82% at 50% 44%, #000 58%, rgba(0,0,0,0.5) 78%, transparent 94%),
    linear-gradient(to bottom, #000 72%, transparent 99%);
  mask-image:
    radial-gradient(72% 82% at 50% 44%, #000 58%, rgba(0,0,0,0.5) 78%, transparent 94%),
    linear-gradient(to bottom, #000 72%, transparent 99%);
  -webkit-mask-composite: source-in;
  mask-composite: intersect;
  filter: brightness(0.97) contrast(1.03);
}
.dgf-shirt-logo {
  position: absolute; left: 50%; top: 74%;
  transform: translateX(-50%);
  font-weight: 900; font-size: 13px; letter-spacing: 0.04em;
  color: var(--dg-neon); opacity: 0.5;
  text-shadow: 0 0 6px var(--dg-glow);
  transition: opacity 160ms ease, text-shadow 160ms ease;
}
.dgf-shirt-logo-flash { opacity: 1; text-shadow: 0 0 22px var(--dg-neon), 0 0 40px var(--dg-glow); }

.dgf-missing {
  position: absolute; left: 50%; top: 40%;
  transform: translate(-50%, -50%);
  width: 78%;
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  padding: 18px 16px; text-align: center;
  border: 1px dashed var(--dg-gold);
  border-radius: 12px;
  background: rgba(255, 216, 74, 0.06);
}
.dgf-missing-badge { font-weight: 900; letter-spacing: 0.18em; color: var(--dg-gold); font-size: 11px; }
.dgf-missing-path { font-family: var(--font-mono, monospace); font-size: 11px; color: var(--dg-white); word-break: break-all; }
.dgf-missing-hint { font-size: 10px; color: var(--dg-muted); }

.dgf-mouth-target {
  position: absolute; width: 22px; height: 22px;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  pointer-events: none;
  opacity: 0;
}
.dgf-mouth-visible { opacity: 1; border: 1.5px solid var(--dg-gold); box-shadow: 0 0 10px var(--dg-gold); }

/* -------------------------------------------------------------------------- */
/*  Instruction                                                               */
/* -------------------------------------------------------------------------- */
.dgf-instruction-wrap {
  position: absolute; left: 0; right: 0; top: 60%; z-index: 5;
  display: flex; justify-content: center;
  padding: 0 20px;
  pointer-events: none;
  min-height: 44px;
}
.dgf-instruction {
  margin: 0; text-align: center;
  font-weight: 900; text-transform: uppercase;
  font-size: clamp(18px, 5.6vw, 24px);
  letter-spacing: 0.04em;
  color: var(--dg-white);
  text-shadow: 0 2px 12px rgba(0,0,0,0.7);
  animation: dgf-instr-in 260ms ease;
}
.dgf-instruction-key { color: var(--dg-neon); text-shadow: 0 0 14px var(--dg-glow); }
@keyframes dgf-instr-in {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}

/* -------------------------------------------------------------------------- */
/*  Trajectory / guides                                                       */
/* -------------------------------------------------------------------------- */
.dgf-trajectory { position: absolute; inset: 0; z-index: 6; pointer-events: none; }
.dgf-guides { position: absolute; inset: 0; z-index: 9; pointer-events: none; opacity: 0.9; }

/* -------------------------------------------------------------------------- */
/*  Tap to shoot                                                              */
/* -------------------------------------------------------------------------- */
.dgf-tap-shoot {
  position: absolute; z-index: 7;
  transform: translate(-50%, 0);
  min-height: 44px; padding: 10px 18px;
  border-radius: 999px;
  border: 1px solid var(--dg-neon);
  background: rgba(168,255,25,0.12);
  color: var(--dg-white);
  font-weight: 800; letter-spacing: 0.14em; font-size: 12px; text-transform: uppercase;
  cursor: pointer;
  opacity: 0; pointer-events: none;
  transition: opacity 300ms ease, background 160ms ease, transform 160ms ease;
}
.dgf-tap-visible { opacity: 1; pointer-events: auto; }
.dgf-tap-shoot:hover { background: rgba(168,255,25,0.22); }
.dgf-tap-shoot:active { transform: translate(-50%, 1px) scale(0.98); }

/* -------------------------------------------------------------------------- */
/*  Ball tray                                                                 */
/* -------------------------------------------------------------------------- */
.dgf-tray-wrap {
  position: absolute; left: 0; right: 0; bottom: 0; z-index: 5;
  padding: 10px 8px calc(env(safe-area-inset-bottom) + 14px);
}
.dgf-tray {
  display: flex; align-items: flex-end; justify-content: center;
  gap: clamp(6px, 2vw, 14px);
}
.dgf-tray-slot {
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  transition: transform ease, opacity ease;
}
.dgf-ball-btn {
  position: relative;
  display: grid; place-items: center;
  border: none; background: none; padding: 0; cursor: pointer;
  border-radius: 50%;
  transition: transform ease, filter ease;
  filter: drop-shadow(0 8px 10px rgba(0,0,0,0.6));
}
.dgf-ball-btn:disabled { cursor: default; }
.dgf-ball-inner { display: block; transition: inherit; }
.dgf-ball-btn:focus-visible { outline: 3px solid var(--dg-neon); outline-offset: 4px; border-radius: 50%; }
.dgf-ball-btn:hover:not(:disabled) { transform: translateY(-4px); }
/* Subtle idle "waiting" bob so the five choices feel alive before a tap. */
.dgf-ball-idle .dgf-ball-inner { animation: dgf-ball-idle 2.6s ease-in-out infinite; }
.dgf-tray-slot:nth-child(1) .dgf-ball-idle .dgf-ball-inner { animation-delay: 0ms; }
.dgf-tray-slot:nth-child(2) .dgf-ball-idle .dgf-ball-inner { animation-delay: 180ms; }
.dgf-tray-slot:nth-child(3) .dgf-ball-idle .dgf-ball-inner { animation-delay: 360ms; }
.dgf-tray-slot:nth-child(4) .dgf-ball-idle .dgf-ball-inner { animation-delay: 540ms; }
.dgf-tray-slot:nth-child(5) .dgf-ball-idle .dgf-ball-inner { animation-delay: 720ms; }
@keyframes dgf-ball-idle {
  0%, 100% { transform: translateY(0) rotate(-3deg); }
  50% { transform: translateY(-5px) rotate(3deg); }
}
.dgf-ball-selecting {
  transform: translateY(-14px) scale(1.16);
  filter: drop-shadow(0 0 16px var(--dg-glow)) drop-shadow(0 10px 14px rgba(0,0,0,0.6));
}
.dgf-ball-selecting::after {
  content: ""; position: absolute; inset: -6px; border-radius: 50%;
  border: 2px solid var(--dg-neon); box-shadow: 0 0 16px var(--dg-glow);
}
.dgf-ball-dim { opacity: 0.4; filter: grayscale(0.3) brightness(0.7); }
.dgf-ball-pulse {
  position: absolute; inset: 0; border-radius: 50%;
  border: 2px solid var(--dg-neon);
  animation: dgf-ball-pulse 500ms ease-out forwards;
}
@keyframes dgf-ball-pulse {
  from { transform: scale(1); opacity: 0.9; }
  to { transform: scale(2); opacity: 0; }
}
.dgf-ball-label {
  font-size: 10px; font-weight: 800; letter-spacing: 0.14em;
  color: var(--dg-muted); text-transform: uppercase;
}

/* -------------------------------------------------------------------------- */
/*  Impact                                                                    */
/* -------------------------------------------------------------------------- */
.dgf-impact { position: absolute; z-index: 6; transform: translate(-50%, -50%); pointer-events: none; }
.dgf-impact-flash {
  position: absolute; left: 0; top: 0; width: 320px; height: 320px;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  background: radial-gradient(circle, rgba(168,255,25,0.85), rgba(168,255,25,0.15) 40%, transparent 68%);
  animation: dgf-flash ease-out forwards;
}
@keyframes dgf-flash {
  0% { opacity: 0; transform: translate(-50%,-50%) scale(0.3); }
  30% { opacity: 1; }
  100% { opacity: 0; transform: translate(-50%,-50%) scale(1.1); }
}
.dgf-impact-ring {
  position: absolute; left: 0; top: 0; width: 40px; height: 40px;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  border: 3px solid var(--dg-neon2);
  animation: dgf-ring ease-out forwards;
}
@keyframes dgf-ring {
  0% { opacity: 0.9; width: 30px; height: 30px; }
  100% { opacity: 0; width: 260px; height: 260px; }
}
.dgf-impact-spark {
  position: absolute; left: 0; top: 0; width: 7px; height: 7px; border-radius: 50%;
  transform: translate(-50%, -50%);
  animation: dgf-spark ease-out forwards;
}
@keyframes dgf-spark {
  0% { opacity: 1; transform: translate(-50%, -50%) translate(0,0) scale(1); }
  100% { opacity: 0; transform: translate(-50%, -50%) translate(var(--dgf-dx), var(--dgf-dy)) scale(0.2); }
}

/* -------------------------------------------------------------------------- */
/*  Prize reveal panel                                                        */
/* -------------------------------------------------------------------------- */
.dgf-panel {
  position: absolute; left: 0; right: 0; bottom: 0; z-index: 20;
  height: 42%;
  transform: translateY(102%);
  transition-property: transform;
  transition-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
  background:
    linear-gradient(180deg, rgba(17,23,18,0.86), rgba(5,7,5,0.96));
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border-top: 2px solid var(--dg-neon);
  box-shadow: 0 -20px 60px rgba(0,0,0,0.7), 0 -2px 30px var(--dg-glow);
  overflow: hidden;
}
.dgf-panel-in { transform: translateY(0); }
.dgf-panel-reduced { transition-duration: 200ms; }
.dgf-panel-edge {
  position: absolute; top: 0; left: 0; right: 0; height: 3px;
  background: linear-gradient(90deg, transparent, var(--dg-neon), transparent);
  box-shadow: 0 0 16px var(--dg-neon);
}
.dgf-panel::before {
  content: ""; position: absolute; inset: 0; opacity: 0.5;
  background: repeating-linear-gradient(115deg, transparent 0 26px, rgba(168,255,25,0.04) 26px 28px);
  pointer-events: none;
}
.dgf-panel-body {
  position: relative; z-index: 2;
  height: 100%;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 10px; padding: 20px 22px calc(env(safe-area-inset-bottom) + 18px); text-align: center;
}
.dgf-rays {
  position: absolute; left: 50%; top: 42%;
  width: 380px; height: 380px; transform: translate(-50%, -50%);
  background: conic-gradient(from 0deg, transparent 0 8deg, rgba(255,216,74,0.16) 8deg 12deg, transparent 12deg 20deg);
  animation: dgf-rays 14s linear infinite;
  pointer-events: none;
}
@keyframes dgf-rays { to { transform: translate(-50%, -50%) rotate(360deg); } }
.dgf-panel-eyebrow {
  margin: 0; font-weight: 900; letter-spacing: 0.24em; text-transform: uppercase;
  font-size: clamp(12px, 3.6vw, 15px);
}
.dgf-eyebrow-win { color: var(--dg-neon); text-shadow: 0 0 14px var(--dg-glow); }
.dgf-eyebrow-none { color: var(--dg-white); }
.dgf-panel-value {
  margin: 0; font-weight: 900; text-transform: uppercase; line-height: 0.95;
  font-size: clamp(30px, 11vw, 54px);
  transform: scale(0.6); opacity: 0;
  text-shadow: 0 0 30px rgba(0,0,0,0.6);
}
.dgf-value-pop { animation: dgf-value-pop 520ms cubic-bezier(0.2, 1.3, 0.4, 1) 120ms forwards; }
@keyframes dgf-value-pop {
  from { transform: scale(0.6); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
.dgf-panel-support {
  margin: 0; color: var(--dg-white); opacity: 0.85;
  font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;
  font-size: clamp(11px, 3vw, 13px);
}
.dgf-next-btn {
  margin-top: 8px;
  min-height: 48px; padding: 12px 30px;
  display: inline-flex; flex-direction: column; align-items: center; gap: 2px;
  border: none; border-radius: 999px;
  background: linear-gradient(180deg, var(--dg-neon), var(--dg-neon2));
  color: #06210a; font-weight: 900; letter-spacing: 0.16em; text-transform: uppercase;
  font-size: 14px; cursor: pointer;
  box-shadow: 0 8px 24px var(--dg-glow);
  transition: transform 140ms ease, box-shadow 140ms ease;
}
.dgf-next-btn:hover { transform: translateY(-2px); box-shadow: 0 12px 30px var(--dg-glow); }
.dgf-next-btn:active { transform: translateY(0) scale(0.98); }
.dgf-next-btn:focus-visible { outline: 3px solid var(--dg-white); outline-offset: 3px; }
.dgf-next-sub { font-size: 9px; letter-spacing: 0.2em; opacity: 0.7; font-weight: 800; }

/* Confetti */
.dgf-confetti { position: absolute; inset: 0; overflow: hidden; pointer-events: none; z-index: 3; }
.dgf-confetti-piece {
  position: absolute; top: -12px; border-radius: 1px;
  animation-name: dgf-confetti; animation-timing-function: ease-in; animation-fill-mode: forwards;
}
@keyframes dgf-confetti {
  0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
  100% { transform: translateY(60vh) rotate(540deg); opacity: 0; }
}

/* Summary */
.dgf-summary { height: 52%; }
.dgf-summary-grid { width: 100%; max-width: 320px; margin: 6px 0; display: flex; flex-direction: column; gap: 8px; }
.dgf-summary-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px; border-radius: 12px;
  background: rgba(168,255,25,0.05); border: 1px solid rgba(168,255,25,0.14);
}
.dgf-summary-row dt { color: var(--dg-muted); font-weight: 700; letter-spacing: 0.08em; font-size: 12px; text-transform: uppercase; }
.dgf-summary-row dd { margin: 0; font-weight: 900; font-size: 20px; }

/* -------------------------------------------------------------------------- */
/*  Sound toggle                                                              */
/* -------------------------------------------------------------------------- */
.dgf-sound-toggle {
  position: absolute; z-index: 30;
  top: calc(env(safe-area-inset-top) + 12px); right: 12px;
  width: 40px; height: 40px; display: grid; place-items: center;
  border-radius: 50%;
  border: 1px solid rgba(255,255,255,0.14);
  background: rgba(5,7,5,0.5);
  color: var(--dg-muted);
  cursor: pointer;
  transition: color 160ms ease, border-color 160ms ease;
}
.dgf-sound-toggle[aria-pressed="true"] { color: var(--dg-neon); border-color: rgba(168,255,25,0.4); }
.dgf-sound-toggle:focus-visible { outline: 3px solid var(--dg-neon); outline-offset: 2px; }

/* -------------------------------------------------------------------------- */
/*  Landscape rotate prompt                                                   */
/* -------------------------------------------------------------------------- */
.dgf-rotate {
  position: absolute; inset: 0; z-index: 60;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px;
  padding: 30px; text-align: center;
  background: rgba(5,7,5,0.96);
}
.dgf-rotate-icon { color: var(--dg-neon); animation: dgf-rotate-nudge 1.8s ease-in-out infinite; }
@keyframes dgf-rotate-nudge { 0%,100% { transform: rotate(0); } 50% { transform: rotate(-90deg); } }
.dgf-rotate-title { margin: 0; font-weight: 900; font-size: 20px; letter-spacing: 0.14em; }
.dgf-rotate-sub { margin: 0; color: var(--dg-muted); font-size: 12px; letter-spacing: 0.14em; max-width: 280px; }

/* -------------------------------------------------------------------------- */
/*  Dev controls                                                              */
/* -------------------------------------------------------------------------- */
.dgf-controls {
  width: 300px; max-height: 92dvh; overflow-y: auto;
  padding: 18px; border-radius: 18px;
  background: var(--dg-panel);
  border: 1px solid rgba(168,255,25,0.16);
  color: var(--dg-white);
  font-size: 13px;
}
.dgf-side-controls { display: none; }
@media (min-width: 900px) { .dgf-side-controls { display: block; } }

.dgf-ctl-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.dgf-ctl-title { font-weight: 900; letter-spacing: 0.16em; font-size: 13px; }
.dgf-ctl-badge {
  font-size: 9px; font-weight: 800; letter-spacing: 0.16em;
  color: var(--dg-black); background: var(--dg-gold);
  padding: 3px 7px; border-radius: 999px;
}
.dgf-ctl-group { border: none; margin: 0 0 16px; padding: 0; }
.dgf-ctl-group legend {
  padding: 0; margin-bottom: 8px;
  font-size: 11px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase;
  color: var(--dg-muted);
}
.dgf-ctl-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.dgf-chip {
  min-height: 34px; padding: 6px 12px;
  border-radius: 999px; cursor: pointer;
  border: 1px solid rgba(255,255,255,0.14);
  background: rgba(255,255,255,0.03);
  color: var(--dg-white); font-size: 12px; font-weight: 700;
  transition: all 140ms ease;
}
.dgf-chip:hover { border-color: rgba(168,255,25,0.4); }
.dgf-chip-on { background: var(--dg-neon); color: var(--dg-black); border-color: var(--dg-neon); }
.dgf-chip:focus-visible { outline: 2px solid var(--dg-neon); outline-offset: 2px; }

.dgf-ctl-toggles { display: flex; flex-direction: column; gap: 10px; }
.dgf-ctl-toggle { display: flex; align-items: center; gap: 10px; cursor: pointer; min-height: 32px; }
.dgf-ctl-toggle input { position: absolute; opacity: 0; width: 0; height: 0; }
.dgf-ctl-track {
  position: relative; width: 40px; height: 22px; flex: 0 0 auto;
  border-radius: 999px; background: rgba(255,255,255,0.14);
  transition: background 160ms ease;
}
.dgf-ctl-thumb {
  position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; border-radius: 50%;
  background: var(--dg-white); transition: transform 160ms ease;
}
.dgf-ctl-toggle input:checked + .dgf-ctl-track { background: var(--dg-neon); }
.dgf-ctl-toggle input:checked + .dgf-ctl-track .dgf-ctl-thumb { transform: translateX(18px); }
.dgf-ctl-toggle input:focus-visible + .dgf-ctl-track { outline: 2px solid var(--dg-neon); outline-offset: 2px; }
.dgf-ctl-toggle-label { font-size: 13px; }
.dgf-ctl-reset {
  width: 100%; min-height: 42px; margin-top: 4px;
  border-radius: 12px; cursor: pointer;
  border: 1px solid rgba(255,255,255,0.16); background: transparent;
  color: var(--dg-white); font-weight: 800; letter-spacing: 0.1em; font-size: 12px; text-transform: uppercase;
  transition: all 140ms ease;
}
.dgf-ctl-reset:hover { border-color: var(--dg-neon); color: var(--dg-neon); }

/* Mobile controls trigger + sheet */
/* Kept in the TOP-LEFT corner, clear of the footballs, result button and
   primary copy which all live lower in the stage. */
.dgf-controls-trigger {
  position: absolute; z-index: 40;
  left: 8px; top: calc(env(safe-area-inset-top) + 8px);
  padding: 5px 10px; min-height: 28px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,0.16);
  background: rgba(5,7,5,0.7);
  backdrop-filter: blur(4px);
  color: var(--dg-muted); font-size: 9px; font-weight: 800; letter-spacing: 0.14em;
  cursor: pointer;
}
@media (min-width: 900px) { .dgf-controls-trigger { display: none; } }
.dgf-sheet-scrim {
  position: absolute; inset: 0; z-index: 70;
  background: rgba(0,0,0,0.6);
  display: flex; align-items: flex-end;
}
.dgf-sheet {
  position: relative;
  width: 100%; max-height: 82dvh; overflow-y: auto;
  padding: 20px 16px calc(env(safe-area-inset-bottom) + 20px);
  border-radius: 20px 20px 0 0;
  background: var(--dg-panel);
  border-top: 2px solid var(--dg-neon);
  animation: dgf-sheet-in 260ms ease;
}
@keyframes dgf-sheet-in { from { transform: translateY(100%); } to { transform: translateY(0); } }
.dgf-sheet .dgf-controls { width: 100%; border: none; padding: 0; background: none; max-height: none; }
.dgf-sheet-close {
  position: absolute; top: 12px; right: 14px; z-index: 2;
  width: 34px; height: 34px; border-radius: 50%;
  border: 1px solid rgba(255,255,255,0.16); background: transparent;
  color: var(--dg-white); font-size: 15px; cursor: pointer;
}

/* -------------------------------------------------------------------------- */
/*  Short-height phones                                                       */
/* -------------------------------------------------------------------------- */
@media (max-height: 700px) {
  .dgf-brand { max-height: 12%; padding-top: calc(env(safe-area-inset-top) + 6px); }
  .dgf-brand-2 { font-size: clamp(22px, 8vw, 34px); }
  .dgf-character { top: 7%; height: 62%; }
  .dgf-instruction-wrap { top: 58%; }
  .dgf-instruction { font-size: clamp(16px, 5vw, 20px); }
}

/* -------------------------------------------------------------------------- */
/*  Accessibility helpers                                                     */
/* -------------------------------------------------------------------------- */
.dgf-page .sr-only {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0;
}

@media (prefers-reduced-motion: reduce) {
  .dgf-page .dgf-breathe,
  .dgf-page .dgf-dg-glow,
  .dgf-page .dgf-particle,
  .dgf-page .dgf-rays,
  .dgf-page .dgf-rotate-icon { animation: none !important; }
}
`
