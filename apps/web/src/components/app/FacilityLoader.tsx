import { useEffect, useState } from 'react';
import { motion, useReducedMotion, type Transition } from 'motion/react';
import { Logo } from './Logo';

/**
 * Branded loading indicator for Facility OS: a bin rides a conveyor through a
 * scan beam that "reads" it (barcode ticks light in sequence), on loop — the
 * core product workflow, distilled to an animation.
 *
 * `variant="splash"` is the full-screen initial-load moment (logo + scene +
 * cycling readout). `variant="inline"` is a compact strip for in-page data
 * loads, a drop-in for the repeated blinking-dot markup.
 *
 * Animation is JS-driven via `motion` (not CSS keyframes) so it survives the
 * global `prefers-reduced-motion` CSS reset in index.css — reduced-motion users
 * get a softened, opacity-only version (ticks pulse, beam fades, no travel).
 */
interface FacilityLoaderProps {
  variant?: 'splash' | 'inline';
  /** Inline caption suffix, e.g. "priority queue" → "SCANNING · priority queue". */
  label?: string;
}

const READOUT_STATES = ['INITIALIZING', 'SCANNING', 'SYNCING FACILITY'] as const;
const TICK_COUNT = 5;

export function FacilityLoader({ variant = 'splash', label }: FacilityLoaderProps) {
  const compact = variant === 'inline';

  if (compact) {
    return (
      <div
        role="status"
        aria-label={label ? `Scanning ${label}` : 'Loading'}
        className="inline-flex items-center gap-3 text-muted"
      >
        <ConveyorScene compact />
        <span className="font-mono text-xs uppercase tracking-[0.16em]">
          Scanning{label ? ` · ${label}` : '…'}
        </span>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-label="Loading Facility OS"
      className="flex min-h-screen flex-col items-center justify-center gap-10 bg-canvas px-6"
    >
      <Logo variant="light" className="h-9 w-auto opacity-90" />
      <ConveyorScene />
      <Readout />
    </div>
  );
}

/* ─── The conveyor scene ─── */

interface SceneProps {
  compact?: boolean;
}

function ConveyorScene({ compact = false }: SceneProps) {
  const reduce = useReducedMotion();

  const width = compact ? 120 : 260;
  const height = compact ? 30 : 84;
  const binW = compact ? 22 : 46;
  const binH = compact ? 18 : 40;
  const centerX = width / 2 - binW / 2;

  // Full motion: bin enters left, crosses the beam, exits right, loops.
  // Reduced motion: bin parks under the beam, no translation.
  const binTransition: Transition = {
    duration: compact ? 1.8 : 2.6,
    repeat: Infinity,
    ease: 'linear',
    repeatDelay: 0.25,
  };
  const binAnimate = reduce
    ? { x: centerX }
    : { x: [-binW - 6, width + 6] };

  return (
    <div className="relative" style={{ width, height }} aria-hidden="true">
      {/* Conveyor belt surface + roller segments */}
      <div className="absolute inset-x-0 bottom-0 h-[3px] rounded-full bg-edge/70" />
      <div
        className="absolute inset-x-0 bottom-[3px] h-1.5 opacity-60"
        style={{
          backgroundImage:
            'repeating-linear-gradient(90deg, rgba(122,114,89,0.35) 0 1px, transparent 1px 11px)',
        }}
      />

      {/* Scan beam (fixed at center) */}
      <motion.div
        className="absolute left-1/2 top-0 z-10 w-[2px] -translate-x-1/2 rounded-full bg-rust"
        style={{ bottom: 3, boxShadow: 'var(--shadow-glow)' }}
        animate={{ opacity: [0.45, 1, 0.45] }}
        transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Read-ticks under the beam — staggered "scanning" pulse */}
      <div className="absolute left-1/2 top-1 z-10 flex -translate-x-1/2 gap-[3px]">
        {Array.from({ length: TICK_COUNT }).map((_, i) => (
          <motion.span
            key={i}
            className={`w-[2px] rounded-full ${i === TICK_COUNT - 1 ? 'bg-live' : 'bg-rust'}`}
            style={{ height: compact ? 8 : 14 }}
            animate={{ opacity: [0.15, 1, 0.15] }}
            transition={{
              duration: 1.1,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: i * 0.12,
            }}
          />
        ))}
      </div>

      {/* The bin (tote with a barcode) */}
      <motion.div
        className="absolute bottom-[3px] rounded-sm rounded-t-md border border-olive-deep/40 bg-olive"
        style={{ width: binW, height: binH }}
        animate={binAnimate}
        transition={reduce ? { duration: 0 } : binTransition}
      >
        <div className="absolute inset-x-1 top-1 flex justify-between">
          {Array.from({ length: compact ? 4 : 7 }).map((_, i) => (
            <span
              key={i}
              className="w-[1.5px] rounded-full bg-bone-light/80"
              style={{ height: compact ? 8 : 18 }}
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
}

/* ─── Cycling mono readout for the splash ─── */

function Readout() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((n) => (n + 1) % READOUT_STATES.length), 1300);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex items-center gap-3 text-muted">
      <span className="h-2 w-2 animate-blink rounded-full bg-rust" />
      <span className="font-mono text-xs uppercase tracking-[0.16em] tabular-nums">
        {READOUT_STATES[i]}
      </span>
    </div>
  );
}
