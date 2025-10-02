"use client"

import { useEffect, useMemo, useRef } from "react"
import { motion, useAnimation, useInView } from "framer-motion"
import { useState } from "react"

// Design tokens used (no direct colors): bg-background, text-foreground, border, primary, primary-foreground, muted-foreground, accent, accent-foreground.

type Metric = {
  label: string
  value: number
  suffix?: string
  duration?: number
}

function useCountUp(target: number, duration = 1200) {
  const value = useRef(0)
  const start = useRef<number | null>(null)

  useEffect(() => {
    const step = (ts: number) => {
      if (start.current === null) start.current = ts
      const progress = Math.min(1, (ts - start.current) / duration)
      value.current = Math.floor(progress * target)
      if (progress < 1) requestAnimationFrame(step)
    }
    const raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])

  return value.current
}

import { easeInOut } from "framer-motion"

const fadeInUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: easeInOut } },
}

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
}

function SiteNav() {
  return (
    <header className="sticky top-0 z-30 bg-white border-b border-gray-200">
      <nav className="flex w-full items-center justify-between py-4">
        <div className="flex items-center gap-3 pl-4 md:pl-8">
          <span
            aria-hidden
            className="h-7 w-7 rounded-md bg-gray-100 ring-1 ring-gray-300 flex items-center justify-center"
          >
            <span className="h-3 w-3 rounded-[2px] bg-black block" />
          </span>
          <span className="text-sm md:text-base font-semibold tracking-tight">FigmaFlow</span>
        </div>
        <div className="flex items-center gap-2 md:gap-3 pr-6 md:pr-8">
          <button
            onClick={() => (window.location.href = "/api/auth/login")}
            className="px-4 py-2 text-sm text-black bg-white border border-black hover:bg-black hover:text-white transition-colors rounded-md"
          >
            Sign In
          </button>
          <button
            onClick={() => (window.location.href = "/api/auth/login")}
            className="px-4 py-2 text-sm rounded-md bg-black text-white border border-black hover:bg-white hover:text-black transition-colors"
          >
            Sign Up
          </button>
        </div>
      </nav>
    </header>
  );
}

function Hero() {
  const controls = useAnimation()
  const [value, setValue] = useState(0)
  useEffect(() => {
    controls.start("visible")
  }, [controls])

  return (
    <section className="relative overflow-hidden">
      {/* subtle background grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [mask-image:radial-gradient(60%_60%_at_50%_10%,black,transparent)]"
      >
        <svg className="absolute inset-0 h-full w-full opacity-[0.06]" role="presentation">
          <defs>
            <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
              <path d="M32 0H0V32" fill="none" stroke="currentColor" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      <div className="mx-auto max-w-6xl px-6 md:px-8 pt-14 md:pt-20 pb-16 md:pb-24">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate={controls}
          className="mx-auto max-w-3xl text-center"
        >
          <motion.h1 variants={fadeInUp} className="text-balance text-4xl md:text-6xl font-bold tracking-tight">
            Turn Figma designs into
            <br />
            <span className="text-primary">clean, production code</span>
          </motion.h1>

          <motion.p variants={fadeInUp} className="mt-5 md:mt-6 text-pretty text-base md:text-lg text-muted-foreground">
            A powerful converter that transforms your Figma files into developer‑ready code. Fast, accurate, and built
            for modern workflows.
          </motion.p>

          <motion.div variants={fadeInUp} className="mt-8 md:mt-10 flex items-center justify-center gap-3">
            <button
              onClick={() => (window.location.href = "/api/auth/login")}
              className="px-5 md:px-6 py-3 rounded-md bg-black text-white border border-black text-sm md:text-base font-medium hover:bg-white hover:text-black transition"
            >
              Get Started
            </button>
            <a
              href="javascript:void(0)"
              className="px-5 md:px-6 py-3 rounded-md border border-black text-sm md:text-base hover:bg-black hover:text-white transition"
              onClick={e => e.preventDefault()}
            >
              See Features
            </a>
          </motion.div>

          {/* floating badges */}
          <div className="relative mt-10 md:mt-12 h-14">
            <motion.div
              aria-hidden
              className="absolute left-0 right-0 mx-auto w-max"
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 4, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
            >
              <span className="rounded-full border border-border/80  px-3 py-1.5 text-xs text-muted-foreground">
                Pixel-accurate layers
              </span>
            </motion.div>
            <motion.div
              aria-hidden
              className="absolute left-6 md:left-24 top-4 w-max"
              animate={{ y: [0, 6, 0] }}
              transition={{ duration: 5, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
            >
              <span className="rounded-full border border-border/80 bg-white px-3 py-1.5 text-xs text-muted-foreground">
                Semantic HTML
              </span>
            </motion.div>
            <motion.div
              aria-hidden
              className="absolute right-6 md:right-24 top-1 w-max"
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 6, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
            >
              <span className="rounded-full border border-border/80  px-3 py-1.5 text-xs text-muted-foreground">
                One Click Deploy
              </span>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

function FeatureCards() {
  const features = [
    {
      title: "Fast Conversion",
      desc: "Process entire Figma files in seconds. Optimized for speed without compromising quality.",
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M13 10V3L4 14h7v7l9-11h-7z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ),
    },
    {
      title: "Precise Output",
      desc: "Accurate spacing, typography, and styling that match your Figma source.",
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
        </svg>
      ),
    },
    {
      title: "Multiple Formats",
      desc: "Export to React, HTML, or other frameworks. Pick what fits your project.",
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M4 4h16v4H4zM4 12h10v8H4zM18 12h2v8h-2z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ),
    },
  ] as const

  return (
    <section id="features" className="max-w-6xl mx-auto px-6 md:px-8 py-16 md:py-20">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
        {features.map((f, i) => (
          <motion.article
            key={f.title}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.5, delay: i * 0.05 }}
            className="rounded-xl border border-border bg-card p-6 md:p-7 hover:shadow-sm transition-shadow"
          >
            <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-accent/40 text-primary">
              {f.icon}
            </div>
            <h3 className="text-base md:text-lg font-semibold">{f.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
          </motion.article>
        ))}
      </div>
    </section>
  )
}

function Metrics() {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: "-100px" })

  const metrics: Metric[] = useMemo(
    () => [
      { label: "Layers parsed", value: 120000, suffix: "+" },
      { label: "Avg. time saved", value: 12, suffix: "h" },
      { label: "Devs onboarded", value: 3500, suffix: "+" },
      { label: "Accuracy", value: 99, suffix: "%" },
    ],
    [],
  )

  return (
    <section ref={ref} className="max-w-6xl mx-auto px-6 md:px-8 py-10 md:py-14">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
        {metrics.map((m, i) => {
          const val = isInView ? m.value : 0
          const n = useCountUp(val, 1000 + i * 150)
          return (
            <div key={m.label} className="rounded-lg border border-border bg-card px-4 py-6 text-center">
              <div className="text-2xl md:text-3xl font-semibold tabular-nums">
                {n.toLocaleString()}
                <span className="align-super text-base md:text-lg">{m.suffix || ""}</span>
              </div>
              <div className="mt-1 text-xs md:text-sm text-muted-foreground">{m.label}</div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function CTA() {
  return (
    <section className="max-w-5xl mx-auto px-6 md:px-8 py-16 md:py-20">
      <div className="rounded-xl border border-border bg-card p-6 md:p-10 flex flex-col md:flex-row items-center gap-4 md:gap-6">
        <div className="flex-1">
          <h2 className="text-balance text-2xl md:text-3xl font-semibold">
            Ship production code from Figma in minutes
          </h2>
          <p className="mt-2 text-sm md:text-base text-muted-foreground">
            Skip boilerplate and focus on logic. Our engine respects your design system tokens.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => (window.location.href = "/api/auth/login")}
            className="px-5 py-3 rounded-md bg-black text-white border border-black text-sm md:text-base font-medium hover:bg-white hover:text-black transition"
          >
            Start Free
          </button>
          <a
            href="javascript:void(0)"
            className="px-5 py-3 rounded-md border border-black text-sm md:text-base hover:bg-black hover:text-white transition"
            onClick={e => e.preventDefault()}
          >
            Learn More
          </a>
        </div>
      </div>
    </section>
  )
}

function SiteFooter() {
  return (
    <footer className="border-t border-border mt-10">
      <div className="max-w-6xl mx-auto px-6 md:px-8 py-8 md:py-10 text-sm text-muted-foreground flex flex-col md:flex-row items-center justify-between gap-3">
        <div>© 2025 FigmaFlow. All rights reserved.</div>
        <nav className="flex items-center gap-6">
          <a className="hover:text-foreground transition-colors" href="#">
            Privacy Policy
          </a>
          <a className="hover:text-foreground transition-colors" href="#">
            Terms of Service
          </a>
          <a className="hover:text-foreground transition-colors" href="#">
            Documentation
          </a>
        </nav>
      </div>
    </footer>
  )
}

export type HomeProps = {
  onGetStarted?: () => void;
};

export function Home(props: HomeProps) {
  // Accept the prop but do not use it (UI unchanged)
  return (
    <div
      className="min-h-screen w-full bg-white text-black relative overflow-hidden"
      style={{
        backgroundImage: 'url(/lightning-bolt.svg)',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: '20 px 20px',
        backgroundSize: '400px auto',
        zIndex: 0,
      }}
    >
      <SiteNav />
      <Hero />
      <FeatureCards />
      <Metrics />
      <CTA />
      <SiteFooter />
    </div>
  );
}

export default function HomePage() {
  return (
    <main className="bg-background text-foreground">
      <Home />
    </main>
  );
}
