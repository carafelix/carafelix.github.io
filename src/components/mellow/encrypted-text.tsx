"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useInView } from "motion/react";

const DEFAULT_GLYPHS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%&*!";

interface EncryptedTextProps {
  text: string;
  trigger?: "scroll" | "hover" | "mount";
  duration?: number;
  stagger?: number;
  glyphs?: string;
  className?: string;
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return reduced;
}

function detGlyph(text: string, i: number, glyphs: string): string {
  let h = 0x811c9dc5;
  for (let j = 0; j < text.length; j++) {
    h = Math.imul(h ^ text.charCodeAt(j), 0x01000193);
  }
  h = Math.imul(h ^ (i * 2654435761), 0x01000193);
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;
  const idx = (h >>> 0) % glyphs.length;
  return glyphs[idx];
}

function randGlyph(glyphs: string): string {
  return glyphs[Math.floor(Math.random() * glyphs.length)];
}

function EncryptedTextInner({
  text,
  trigger = "scroll",
  duration = 1500,
  stagger = 30,
  glyphs = DEFAULT_GLYPHS,
  className,
}: EncryptedTextProps) {
  const reducedMotion = useReducedMotion();
  const containerRef = useRef<HTMLSpanElement>(null);
  const [hovered, setHovered] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
  const isInView = useInView(containerRef, {
    once: true,
    margin: "0px 0px -15% 0px",
  });

  const startScrambled = trigger === "scroll" || trigger === "mount";
  const [chars, setChars] = useState<string[]>(() => {
    if (!startScrambled) return text.split("");
    return text.split("").map((c, i) =>
      c === " " ? " " : detGlyph(text, i, glyphs)
    );
  });

  const active = useMemo(() => {
    if (trigger === "scroll") return isInView;
    if (trigger === "hover") return hovered;
    if (trigger === "mount") return hasMounted;
    return false;
  }, [trigger, isInView, hovered, hasMounted]);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    if (reducedMotion) {
      setChars(text.split(""));
      return;
    }

    if (!active) {
      if (trigger === "hover") {
        setChars(text.split(""));
      }
      return;
    }

    const target = text.split("");
    const charState = target.map((c, i) => ({
      glyph: c === " " ? " " : detGlyph(text, i, glyphs),
      lastSwap: 0,
    }));

    let raf = 0;
    let startTime = 0;
    let cancelled = false;

    const tick = (timestamp: number) => {
      if (cancelled) return;
      if (!startTime) {
        startTime = timestamp;
        for (const s of charState) s.lastSwap = timestamp;
      }
      const elapsed = timestamp - startTime;

      const next = target.map((targetChar, i) => {
        if (targetChar === " ") return " ";
        const charDelay = i * stagger;
        const charElapsed = elapsed - charDelay;
        const state = charState[i];

        if (charElapsed < 0) {
          if (timestamp - state.lastSwap >= 28) {
            state.glyph = randGlyph(glyphs);
            state.lastSwap = timestamp;
          }
          return state.glyph;
        }

        // Each character gets its own full-length resolve window starting at
        // its own delay — NOT `duration - charDelay`, which would shrink
        // later characters' windows just enough that every letter locks in
        // at the same instant instead of genuinely left-to-right.
        const resolveDuration = Math.max(duration, 220);
        const progress = Math.min(charElapsed / resolveDuration, 1);

        if (progress >= 1) {
          state.glyph = targetChar;
          return targetChar;
        }

        let swapInterval: number;
        if (progress < 0.6) {
          swapInterval = 28;
        } else {
          const t = (progress - 0.6) / 0.4;
          const eased = t * t * t;
          swapInterval = 28 + eased * 260;
        }

        if (timestamp - state.lastSwap >= swapInterval) {
          state.glyph = randGlyph(glyphs);
          state.lastSwap = timestamp;
        }
        return state.glyph;
      });

      setChars(next);

      const totalDuration = duration + target.length * stagger + 60;
      if (elapsed < totalDuration) {
        raf = requestAnimationFrame(tick);
      } else {
        setChars(target);
      }
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [active, trigger, text, duration, stagger, glyphs, reducedMotion]);

  const handlers =
    trigger === "hover"
      ? {
          onMouseEnter: () => setHovered(true),
          onMouseLeave: () => setHovered(false),
        }
      : {};

  return (
    <span
      ref={containerRef}
      className={["inline-block relative whitespace-nowrap", className].filter(Boolean).join(" ")}
      aria-label={text}
      {...handlers}
    >
      <span aria-hidden="true" className="invisible select-none">
        {text}
      </span>
      <span aria-hidden="true" className="absolute inset-0">
        {chars.map((char, i) => (
          <span key={i} className="[font-variant-numeric:tabular-nums]">
            {char}
          </span>
        ))}
      </span>
      <span className="sr-only">{text}</span>
    </span>
  );
}

export function EncryptedText(props: EncryptedTextProps) {
  return <EncryptedTextInner {...props} />;
}

export default EncryptedText;
