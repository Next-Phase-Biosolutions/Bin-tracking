import { motion } from 'motion/react';
import { useEffect, useRef, useState, useMemo } from 'react';

type AnimationSnapshot = {
  filter?: string;
  opacity?: number;
  y?: number;
};

function buildKeyframes(
  from: AnimationSnapshot,
  steps: AnimationSnapshot[]
): Record<string, (string | number | undefined)[]> {
  const keys = new Set([...Object.keys(from), ...steps.flatMap((s) => Object.keys(s))]);
  const keyframes: Record<string, (string | number | undefined)[]> = {};
  keys.forEach((k) => {
    keyframes[k] = [from[k as keyof AnimationSnapshot], ...steps.map((s) => s[k as keyof AnimationSnapshot])];
  });
  return keyframes;
}

interface BlurTextProps {
  text?: string;
  delay?: number;
  className?: string;
  animateBy?: 'words' | 'letters';
  direction?: 'top' | 'bottom';
  threshold?: number;
  rootMargin?: string;
  stepDuration?: number;
  onAnimationComplete?: () => void;
}

export function BlurText({
  text = '',
  delay = 120,
  className = '',
  animateBy = 'words',
  direction = 'top',
  threshold = 0.1,
  rootMargin = '0px',
  stepDuration = 0.38,
  onAnimationComplete,
}: BlurTextProps) {
  const elements = animateBy === 'words' ? text.split(' ') : text.split('');
  const [inView, setInView] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold, rootMargin }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [threshold, rootMargin]);

  const fromSnapshot = useMemo<AnimationSnapshot>(
    () =>
      direction === 'top'
        ? { filter: 'blur(12px)', opacity: 0, y: -40 }
        : { filter: 'blur(12px)', opacity: 0, y: 40 },
    [direction]
  );

  const toSnapshots = useMemo<AnimationSnapshot[]>(
    () => [
      { filter: 'blur(4px)', opacity: 0.5, y: direction === 'top' ? 5 : -5 },
      { filter: 'blur(0px)', opacity: 1, y: 0 },
    ],
    [direction]
  );

  const stepCount = toSnapshots.length + 1;
  const totalDuration = stepDuration * (stepCount - 1);
  const times = Array.from({ length: stepCount }, (_, i) => (stepCount === 1 ? 0 : i / (stepCount - 1)));

  return (
    <p ref={ref} className={className} style={{ display: 'flex', flexWrap: 'wrap' }}>
      {elements.map((segment, index) => {
        const animateKeyframes = buildKeyframes(fromSnapshot, toSnapshots);
        return (
          <motion.span
            className="inline-block will-change-[transform,filter,opacity]"
            key={index}
            initial={fromSnapshot}
            animate={inView ? (animateKeyframes as Parameters<typeof motion.span>[0]['animate']) : fromSnapshot}
            transition={{
              duration: totalDuration,
              times,
              delay: (index * delay) / 1000,
              ease: [0.16, 1, 0.3, 1],
            }}
            onAnimationComplete={index === elements.length - 1 ? onAnimationComplete : undefined}
          >
            {segment === ' ' ? ' ' : segment}
            {animateBy === 'words' && index < elements.length - 1 && ' '}
          </motion.span>
        );
      })}
    </p>
  );
}

export default BlurText;
