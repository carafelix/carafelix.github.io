"use client";

import React, { useEffect, useRef } from "react";

export interface ParticleWordProps {
  /** The word (or short phrase) to assemble from particles. */
  text: string;
  /** Font family for the sampled glyphs. Defaults to the `--font-serif` token. */
  fontFamily?: string;
  fontStyle?: "normal" | "italic";
  fontWeight?: number | string;
  /** Particle color. Defaults to a themed ink color that flips with the theme. */
  color?: string;
  /** Sample step in CSS px — lower is denser (more particles). Defaults to 2 below 700px width, 3 above. */
  density?: number;
  /** Radius (px) of the cursor repel field. */
  repelRadius?: number;
  /** How hard particles scatter away from the cursor. */
  repelStrength?: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Renders text into an offscreen canvas, samples the glyph pixels, and
 * rebuilds the word from thousands of ink particles. Particles spring-assemble
 * on mount, drift on per-particle phase, and scatter away from the cursor.
 */
export function ParticleWord({
  text,
  fontFamily,
  fontStyle = "italic",
  fontWeight = 400,
  color,
  density,
  repelRadius = 140,
  repelStrength = 2.4,
  className,
  style,
}: ParticleWordProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!wrapRef.current || !canvasRef.current) return;
    const wrap: HTMLDivElement = wrapRef.current;
    const canvas: HTMLCanvasElement = canvasRef.current;
    const ctxOrNull = canvas.getContext("2d");
    if (!ctxOrNull) return;
    const ctx: CanvasRenderingContext2D = ctxOrNull;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    let ink = "244, 241, 236";
    const readInk = () => {
      const v = getComputedStyle(document.documentElement)
        .getPropertyValue("--ink-rgb")
        .trim();
      if (v) ink = v;
    };
    readInk();
    const themeObs = new MutationObserver(readInk);
    themeObs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style", "data-theme"],
    });

    const fillStyle = () => color ?? `rgba(${ink}, 0.92)`;

    // stride: x, y, vx, vy, tx, ty, size, phase
    const STRIDE = 8;
    let particles = new Float32Array(0);
    let count = 0;
    let raf = 0;
    let running = false;
    let visible = true;
    let startTime = 0;
    let w = 0;
    let h = 0;
    let dpr = 1;
    let rect = wrap.getBoundingClientRect();

    const pointer = { x: -9999, y: -9999, active: false };

    const sampleTargets = (): { x: number; y: number }[] => {
      rect = wrap.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      if (w < 4 || h < 4) return [];

      const off = document.createElement("canvas");
      off.width = Math.ceil(w);
      off.height = Math.ceil(h);
      const octx = off.getContext("2d");
      if (!octx) return [];

      const family =
        fontFamily ??
        (getComputedStyle(document.documentElement)
          .getPropertyValue("--font-serif")
          .trim() ||
          "serif");

      // Fit the *rendered ink box* on both axes. Sizing off the em box alone
      // lets a font with tall or wide-overhanging glyphs (a fallback face, or
      // any serif with an italic swash) bleed past the canvas edge — the
      // clipped row then samples as a dense line of particles under the word.
      let fontSize = h * 0.92;
      octx.textAlign = "center";
      octx.textBaseline = "alphabetic";
      octx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${family}`;
      // measured with the same alignment used to draw — the ink box is
      // reported relative to the anchor, so alignment has to be set first
      const m = octx.measureText(text);
      const left = m.actualBoundingBoxLeft ?? m.width / 2;
      const right = m.actualBoundingBoxRight ?? m.width / 2;
      const ascent = m.actualBoundingBoxAscent || fontSize * 0.8;
      const descent = m.actualBoundingBoxDescent || fontSize * 0.2;
      const inkW = left + right || 1;
      const inkH = ascent + descent || 1;
      const fit = Math.min((w * 0.96) / inkW, (h * 0.92) / inkH, 1);
      fontSize *= fit;
      octx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${family}`;
      octx.fillStyle = "#fff";
      // metrics scale linearly with font size — centre the ink box, not the em box
      octx.fillText(
        text,
        w / 2 + ((left - right) / 2) * fit,
        (h + (ascent - descent) * fit) / 2
      );

      const data = octx.getImageData(0, 0, off.width, off.height).data;
      const step = Math.max(1, Math.floor(density ?? (w < 700 ? 2 : 3)));
      const targets: { x: number; y: number }[] = [];
      for (let y = 0; y < off.height; y += step) {
        for (let x = 0; x < off.width; x += step) {
          if (data[(y * off.width + x) * 4 + 3] > 128) {
            targets.push({ x, y });
          }
        }
      }
      return targets;
    };

    const build = () => {
      const targets = sampleTargets();
      count = targets.length;
      particles = new Float32Array(count * STRIDE);
      const step = Math.max(1, Math.floor(density ?? (w < 700 ? 2 : 3)));
      for (let i = 0; i < count; i++) {
        const o = i * STRIDE;
        // spawn scattered well outside the glyphs
        particles[o] = Math.random() * w;
        particles[o + 1] = Math.random() * h * 2 - h * 0.5;
        particles[o + 2] = 0;
        particles[o + 3] = 0;
        particles[o + 4] = targets[i].x;
        particles[o + 5] = targets[i].y;
        particles[o + 6] = step * (0.5 + Math.random() * 0.45);
        particles[o + 7] = Math.random() * Math.PI * 2;
      }
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.ceil(w * dpr);
      canvas.height = Math.ceil(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      startTime = performance.now();
    };

    /**
     * The backing store is rounded up to whole device pixels while w/h stay
     * fractional CSS px, so clearing to (w, h) leaves the last row and column
     * only fractionally cleared. Ink accumulates there frame after frame until
     * it reads as a hard line of particles along the edge — clear the whole
     * store, in the same CSS-px space the transform draws in.
     */
    const clear = () => {
      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    };

    const drawStatic = () => {
      clear();
      ctx.fillStyle = fillStyle();
      for (let i = 0; i < count; i++) {
        const o = i * STRIDE;
        const s = particles[o + 6];
        ctx.fillRect(particles[o + 4], particles[o + 5], s, s);
      }
    };

    const frame = (now: number) => {
      if (!running) return;
      const t = (now - startTime) / 1000;
      // spring ramps in over the first 1.6s for the assembly intro
      const k = 0.018 + Math.min(t / 1.6, 1) * 0.052;
      const damping = 0.84;
      const R = Math.min(repelRadius, w * 0.18);
      const R2 = R * R;

      clear();
      ctx.fillStyle = fillStyle();

      for (let i = 0; i < count; i++) {
        const o = i * STRIDE;
        const phase = particles[o + 7];
        const tx = particles[o + 4] + Math.sin(t * 0.9 + phase) * 1.1;
        const ty = particles[o + 5] + Math.cos(t * 0.7 + phase * 1.3) * 1.1;

        let vx = particles[o + 2] + (tx - particles[o]) * k;
        let vy = particles[o + 3] + (ty - particles[o + 1]) * k;

        if (pointer.active) {
          const dx = particles[o] - pointer.x;
          const dy = particles[o + 1] - pointer.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < R2 && d2 > 0.01) {
            const d = Math.sqrt(d2);
            const f = ((R - d) / R) * repelStrength;
            vx += (dx / d) * f;
            vy += (dy / d) * f;
          }
        }

        vx *= damping;
        vy *= damping;
        particles[o] += vx;
        particles[o + 1] += vy;
        particles[o + 2] = vx;
        particles[o + 3] = vy;

        const s = particles[o + 6];
        ctx.fillRect(particles[o], particles[o + 1], s, s);
      }
      raf = requestAnimationFrame(frame);
    };

    const start = () => {
      if (running || reduced || !visible || document.hidden) return;
      running = true;
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    const onPointerMove = (e: PointerEvent) => {
      // touch has no hover — a tap would otherwise leave the repel field
      // parked under the word for good, dragging particles out of the glyphs
      if (e.pointerType !== "mouse") {
        pointer.active = false;
        return;
      }
      pointer.x = e.clientX - rect.left;
      pointer.y = e.clientY - rect.top;
      pointer.active = true;
    };
    const onPointerLeave = () => {
      pointer.active = false;
    };
    const onScroll = () => {
      rect = wrap.getBoundingClientRect();
    };

    let lastWidth = 0;
    let lastHeight = 0;
    let resizeTimer = 0;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[entries.length - 1];
      const box = entry?.contentRect ?? wrap.getBoundingClientRect();
      if (Math.abs(box.width - lastWidth) < 0.5 && Math.abs(box.height - lastHeight) < 0.5) {
        return;
      }
      lastWidth = box.width;
      lastHeight = box.height;
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        build();
        if (reduced) drawStatic();
      }, 150);
    });

    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible) start();
        else stop();
      },
      { threshold: 0.05 }
    );

    const onVisibility = () => {
      if (document.hidden) stop();
      else start();
    };

    let cancelled = false;
    document.fonts.ready.then(() => {
      if (cancelled) return;
      build();
      if (reduced) {
        drawStatic();
      } else {
        start();
      }
      ro.observe(wrap);
      io.observe(wrap);
    });

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    wrap.addEventListener("pointerleave", onPointerLeave);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      stop();
      themeObs.disconnect();
      ro.disconnect();
      io.disconnect();
      window.clearTimeout(resizeTimer);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("scroll", onScroll);
      wrap.removeEventListener("pointerleave", onPointerLeave);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [text, fontFamily, fontStyle, fontWeight, color, density, repelRadius, repelStrength]);

  return (
    <div
      ref={wrapRef}
      role="img"
      aria-label={text}
      className={["relative h-full w-full", className].filter(Boolean).join(" ")}
      style={style}
    >
      <canvas ref={canvasRef} aria-hidden="true" className="block h-full w-full" />
    </div>
  );
}

export default ParticleWord;
