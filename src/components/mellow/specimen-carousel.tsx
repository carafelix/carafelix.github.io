"use client";

import React, { useEffect, useMemo, useState } from "react";

export interface SampleImage {
  src: string;
  alt?: string;
}

export interface SpecimenItem {
  title: string;
  kicker?: string;
  description?: string;
  links?: [string, string][];
  meta?: string;
  sample?: string | SampleImage;
}

export interface SpecimenCarouselProps {
  items?: SpecimenItem[];
  initialIndex?: number;
  autoPlay?: boolean;
  interval?: number;
  className?: string;
  style?: React.CSSProperties;
  onIndexChange?: (index: number) => void;
  mirror?: boolean;
}

const DEFAULT_ITEMS: SpecimenItem[] = [
  {
    kicker: "Specimen 01",
    title: "Editorial",
    sample: "Aa",
    meta: "72 pt / italic",
    description:
      "A slow snap carousel for type samples, product stories, and image-led editorial modules.",
  },
  {
    kicker: "Specimen 02",
    title: "Mechanical",
    sample: "Rr",
    meta: "Mono rail",
    description:
      "Numbered tabs, registration marks, and a hard-set stage keep the motion tactile.",
  },
  {
    kicker: "Specimen 03",
    title: "Archive",
    sample: "Gg",
    meta: "Folio set",
    description:
      "Each panel behaves like a printed card sliding under a loupe, not a generic carousel.",
  },
];

function SampleSlot({ text }: { text: string }) {
  return (
    <span className="font-serif text-[clamp(3.75rem,20vw,13rem)] italic leading-[0.72] tracking-[-0.12em] text-(--ink)">
      {text}
    </span>
  );
}

function clampIndex(index: number, length: number) {
  if (length === 0) return 0;
  return ((index % length) + length) % length;
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return reduced;
}

function FolioAside({ folio, mirror }: { folio: string; mirror: boolean }) {
  return (
    <aside
      className={[
        "hidden md:flex md:flex-col md:justify-between",
        mirror ? "border-l" : "border-r",
        "border-(--rule)",
      ].join(" ")}
    >
      <div className="p-4 font-mono text-[0.65rem] uppercase tracking-[0.18em] text-[rgba(var(--ink-rgb),0.45)] [writing-mode:vertical-rl]">
        specimen index
      </div>
      <div className="border-t border-(--rule) p-4 font-mono text-3xl tracking-[-0.12em]">
        {folio}
      </div>
    </aside>
  );
}

export function SpecimenCarousel({
  items = DEFAULT_ITEMS,
  initialIndex = 0,
  autoPlay = false,
  interval = 4200,
  className,
  style,
  onIndexChange,
  mirror = false,
}: SpecimenCarouselProps) {
  const reduced = usePrefersReducedMotion();
  const safeItems = items.length > 0 ? items : DEFAULT_ITEMS;
  const [index, setIndex] = useState(() => clampIndex(initialIndex, safeItems.length));

  const active = safeItems[index];
  const folio = useMemo(() => String(index + 1).padStart(2, "0"), [index]);

  const goTo = (nextIndex: number) => {
    const next = clampIndex(nextIndex, safeItems.length);
    setIndex(next);
    onIndexChange?.(next);
  };

  useEffect(() => {
    setIndex((current) => clampIndex(current, safeItems.length));
  }, [safeItems.length]);

  useEffect(() => {
    if (!autoPlay || reduced || safeItems.length < 2) return;
    const id = window.setInterval(() => {
      setIndex((current) => {
        const next = clampIndex(current + 1, safeItems.length);
        onIndexChange?.(next);
        return next;
      });
    }, interval);
    return () => window.clearInterval(id);
  }, [autoPlay, interval, onIndexChange, reduced, safeItems.length]);

  const controls = mirror
    ? [
        { label: "Next specimen", onClick: () => goTo(index + 1), glyph: "←" },
        { label: "Previous specimen", onClick: () => goTo(index - 1), glyph: "→" },
      ]
    : [
        { label: "Previous specimen", onClick: () => goTo(index - 1), glyph: "←" },
        { label: "Next specimen", onClick: () => goTo(index + 1), glyph: "→" },
      ];

  return (
    <section
      className={[
        "relative overflow-hidden border border-(--rule) bg-(--background) text-(--ink)",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={style}
      aria-roledescription="carousel"
      aria-label="Specimen carousel"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight") goTo(index + (mirror ? -1 : 1));
        if (event.key === "ArrowLeft") goTo(index - (mirror ? -1 : 1));
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(var(--ink-rgb),0.055)_1px,transparent_1px),linear-gradient(0deg,rgba(var(--ink-rgb),0.04)_1px,transparent_1px)] bg-size-[48px_48px]" />

      <div
        className={[
          "relative grid min-h-[268px] grid-cols-1 sm:min-h-[420px]",
          mirror ? "md:grid-cols-[1fr_7rem]" : "md:grid-cols-[7rem_1fr]",
        ].join(" ")}
      >
        {!mirror && <FolioAside folio={folio} mirror={mirror} />}

        <div className="relative flex min-h-[268px] min-w-0 flex-col justify-between p-3 sm:min-h-[420px] sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[0.68rem] uppercase tracking-[0.22em] text-[rgba(var(--ink-rgb),0.5)]">
                {active.kicker ?? `Specimen ${folio}`}
              </p>
              <p className="mt-2 font-mono text-[0.68rem] uppercase tracking-[0.18em] text-[rgba(var(--ink-rgb),0.34)]">
                {active.meta ?? "Folio carousel"}
              </p>
            </div>

            <div className="flex border border-(--rule) bg-[rgba(var(--background-rgb),0.72)]">
              {controls.map((button, buttonIndex) => (
                <button
                  key={button.label}
                  type="button"
                  onClick={button.onClick}
                  aria-label={button.label}
                  className={[
                    "h-9 w-9 cursor-pointer font-mono text-sm sm:h-10 sm:w-10 text-(--ink) transition-colors hover:bg-[rgba(var(--ink-rgb),0.08)]",
                    buttonIndex === 0 ? "border-r border-(--rule)" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {button.glyph}
                </button>
              ))}
            </div>
          </div>

          <div className="grid items-end gap-3 py-2 sm:gap-6 sm:py-10 md:grid-cols-[minmax(0,1fr)_13rem]">
            <div className="min-w-0">
              <div className="relative mb-3 inline-flex m-2 my-5 sm:mx-auto">
                <span
                  className={[
                    "absolute -top-3 h-3 w-3 border-t border-(--ink)",
                    mirror ? "-right-3 border-r" : "-left-3 border-l",
                  ].join(" ")}
                />
                <span
                  className={[
                    "absolute -bottom-3 h-3 w-3 border-b border-(--ink)",
                    mirror ? "-left-3 border-l" : "-right-3 border-r",
                  ].join(" ")}
                />
                {active.sample == null ? (
                  <SampleSlot text={active.title.slice(0, 2)} />
                ) : typeof active.sample === "string" ? (
                  <SampleSlot text={active.sample} />
                ) : (
                  <img
                    src={active.sample.src}
                    alt={active.sample.alt ?? active.title}
                    className="h-[calc(clamp(3.75rem,20vw,13rem)_*_0.72)] w-auto max-w-full object-contain grayscale"
                  />
                )}
              </div>
              <h3 className="pt-4 font-serif text-[clamp(2.25rem,8vw,6rem)] italic leading-[0.86] tracking-[-0.075em]">
                {active.title}
              </h3>
            </div>

            <div className="min-w-0">
              <p className="max-w-full text-[0.8125rem] leading-5 text-[rgba(var(--ink-rgb),0.58)] sm:text-sm sm:leading-6">
                {active.description ??
                  "Use this panel for a type specimen, featured artifact, product detail, or editorial story."}
              </p>
{active.links && active.links.length > 0 && (
                <div className="mt-3 flex flex-wrap justify-end gap-2">
                  {active.links.map(([href, label]) => (
                    <a
                      key={href}
                      href={href}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex max-w-full justify-center border border-(--rule) px-3 py-2 font-mono text-xs uppercase tracking-[0.18em] text-(--ink) transition-colors hover:border-[rgba(var(--ink-rgb),0.42)] hover:bg-[rgba(var(--ink-rgb),0.08)]"
                    >
                      <span className="truncate">{label}</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="overflow-hidden border-t border-(--rule) pt-2 sm:pt-4">
            <div
              className={[
                "flex gap-3 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                mirror ? "flex-row-reverse" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={{ transform: `translateX(${(mirror ? 1 : -1) * Math.max(0, index - 1) * 8.75}rem)` }}
            >
              {safeItems.map((item, itemIndex) => {
                const activeItem = itemIndex === index;
                return (
                  <button
                    key={`${item.title}-${itemIndex}`}
                    type="button"
                    onClick={() => goTo(itemIndex)}
                    className={[
                      "min-w-28 cursor-pointer border p-2.5 text-left transition-all duration-300 sm:min-w-32 sm:p-3 my-[2px]",
                      activeItem
                        ? "border-(--ink) bg-(--ink) text-(--background)"
                        : "border-(--rule) bg-[rgba(var(--background-rgb),0.66)] text-(--ink) hover:border-[rgba(var(--ink-rgb),0.42)]",
                    ].join(" ")}
                    aria-label={`Show ${item.title}`}
                    aria-current={activeItem ? "true" : undefined}
                  >
                    <span className="block font-mono text-[0.62rem] uppercase tracking-[0.18em] opacity-60">
                      {String(itemIndex + 1).padStart(2, "0")}
                    </span>
                    <span className="mt-2 block truncate font-serif text-lg italic sm:mt-4 sm:text-xl tracking-[-0.04em]">
                      {item.title}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {mirror && <FolioAside folio={folio} mirror={mirror} />}
      </div>
    </section>
  );
}

export default SpecimenCarousel;