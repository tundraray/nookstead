'use client';

import { useEffect, useRef, useState } from 'react';

/* Content sourced from GDD v3.0, Section 3 — Design Pillars */
const pillars = [
  {
    icon: '/assets/ui/landing/world.png',
    title: 'LIVING WORLD',
    desc: 'The town does not wait for you. NPCs wake up, go to work, chat, argue, and reconcile on their own schedule.',
  },
  {
    icon: '/assets/ui/landing/brain.png',
    title: 'MEANINGFUL CONNECTIONS',
    desc: 'Every conversation is remembered. Relationships are built through living memory, not a friendship bar.',
  },
  {
    icon: '/assets/ui/landing/home.png',
    title: 'YOUR NOOK',
    desc: 'House, yard, farm, animals — a space for self-expression. The place you want to return to.',
  },
  {
    icon: '/assets/ui/landing/hands.png',
    title: 'SHARED LIFE',
    desc: 'Players and AI residents coexist in the same town. The line between real and virtual is intentionally blurred.',
  },
];

export function LandingContent() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true);
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`landing-panel ${visible ? 'landing-panel--visible' : ''}`}
    >
      <div className="landing-panel__divider" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>

      {/* GDD v3.0 Section 2.2 — Positioning */}
      <h2 className="landing-panel__heading">
        THE COZY MMO WHERE EVERY
        <br />
        CHARACTER REMEMBERS YOUR NAME
      </h2>

      <div className="landing-panel__grid">
        {pillars.map((p) => (
          <div key={p.title} className="landing-card">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="landing-card__icon"
              src={p.icon}
              alt=""
              aria-hidden="true"
            />
            <h3 className="landing-card__title">{p.title}</h3>
            <p className="landing-card__desc">{p.desc}</p>
          </div>
        ))}
      </div>

      {/* GDD v3.0 Section 2.2 — USP */}
      <p className="landing-panel__tagline">
        AI-powered NPCs with memory, reflection, and autonomous planning
        create stories that no developer scripted — accessible from any
        browser.
      </p>

      <div className="landing-panel__divider" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}
