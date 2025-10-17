"use client"

import { easeInOut } from "framer-motion"
import { useEffect, useMemo, useRef, useState } from "react"
import { motion, useAnimation, useInView } from "framer-motion"
import Galaxy from "./Galaxy"
import BlurText from "./BlurText";

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
    <header className="sticky top-0 z-30 bg-black/80 border-b border-gray-800 backdrop-blur-sm">
      <nav className="flex w-full items-center justify-between py-4">
        <div className="flex items-center gap-3 pl-4 md:pl-8">
          <span
            aria-hidden
            className="h-7 w-7 rounded-md bg-white ring-1 ring-gray-600 flex items-center justify-center"
          >
            <span className="h-3 w-3 rounded-[2px] bg-black block" />
          </span>
          <span className="text-sm md:text-base font-semibold tracking-tight text-white">FigmaFlow</span>
        </div>
        <div className="flex items-center gap-2 md:gap-3 pr-6 md:pr-8">
          <button
            onClick={() => (window.location.href = "/api/auth/login")}
            className="px-4 py-2 text-sm text-white bg-black border border-white hover:bg-white hover:text-black transition-colors rounded-md"
          >
            Sign In
          </button>
          <button
            onClick={() => (window.location.href = "/api/auth/login")}
            className="px-4 py-2 text-sm rounded-md bg-white text-black border border-white hover:bg-black hover:text-white transition-colors"
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

      <div className="mx-auto max-w-6xl px-6 md:px-8 pt-14 md:pt-32 pb-16 md:pb-36 min-h-[90vh] flex items-center">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate={controls}
          className="mx-auto max-w-3xl text-center"
        >
          <motion.h1 
            variants={fadeInUp} 
            className="text-balance text-4xl md:text-6xl tracking-tight text-white"
            style={{ fontFamily: 'var(--font-outfit)' }}
          >
            <BlurText
              text="Turn Figma designs into clean,"
              delay={100}
              animateBy="words"
              className="inline-block text-balance text-4xl md:text-6xl tracking-tight text-white font-medium"
              animationFrom={{ filter: 'blur(20px)', opacity: 0, y: -30 }}
              animationTo={[
                { filter: 'blur(10px)', opacity: 0.7, y: -15 },
                { filter: 'blur(5px)', opacity: 0.9, y: -5 },
                { filter: 'blur(0px)', opacity: 1, y: 0 }
              ]}
              stepDuration={0.5}
              onAnimationComplete={() => {}}
            />
            {' '}
            <BlurText
              text="production code"
              delay={200}
              animateBy="words"
              className="inline-block text-balance text-4xl md:text-6xl tracking-tight font-semibold text-orange-500"
              animationFrom={{ filter: 'blur(20px)', opacity: 0, y: -30 }}
              animationTo={[
                { filter: 'blur(10px)', opacity: 0.7, y: -15 },
                { filter: 'blur(5px)', opacity: 0.9, y: -5 },
                { filter: 'blur(0px)', opacity: 1, y: 0 }
              ]}
              stepDuration={0.5}
              onAnimationComplete={() => {}}
            />
          </motion.h1>

          <motion.p 
            variants={fadeInUp} 
            className="mt-5 md:mt-6 text-pretty text-base md:text-lg text-gray-300"
            style={{ fontFamily: 'var(--font-inter)' }}
          >
            <BlurText
              text="A powerful converter that transforms your Figma files into developer-ready code. Fast, accurate, and built for modern workflows."
              delay={50}
              animateBy="words"
              className="mt-5 md:mt-6 text-pretty text-base md:text-lg text-gray-300 leading-relaxed"
              animationFrom={{ filter: 'blur(15px)', opacity: 0, y: -20 }}
              animationTo={[
                { filter: 'blur(8px)', opacity: 0.7, y: -10 },
                { filter: 'blur(4px)', opacity: 0.9, y: -5 },
                { filter: 'blur(0px)', opacity: 1, y: 0 }
              ]}
              stepDuration={0.4}
              onAnimationComplete={() => {}}
            />
          </motion.p>

          <motion.div variants={fadeInUp} className="mt-8 md:mt-10 flex items-center justify-center gap-3">
            <button
              onClick={() => (window.location.href = "/api/auth/login")}
              className="px-5 md:px-6 py-3 rounded-md bg-white text-black border border-white hover:bg-black hover:text-white transition"
            >
              Get Started
            </button>
            <a
              href="javascript:void(0)"
              className="px-5 md:px-6 py-3 rounded-md border border-white text-white hover:bg-white hover:text-black transition"
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
              <span className="rounded-full border border-gray-600 bg-black/50 px-3 py-1.5 text-xs text-gray-300">
                Pixel-accurate layers
              </span>
            </motion.div>
            <motion.div
              aria-hidden
              className="absolute left-6 md:left-24 top-4 w-max"
              animate={{ y: [0, 6, 0] }}
              transition={{ duration: 5, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
            >
              <span className="rounded-full border border-gray-600 bg-white/10 px-3 py-1.5 text-xs text-gray-300">
                Semantic HTML
              </span>
            </motion.div>
            <motion.div
              aria-hidden
              className="absolute right-6 md:right-24 top-1 w-max"
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 6, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
            >
              <span className="rounded-full border border-gray-600 bg-black/50 px-3 py-1.5 text-xs text-gray-300">
                One Click Deploy
              </span>
            </motion.div>
          </div>
        </motion.div>
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
            <div key={m.label} className="rounded-lg border border-gray-700 bg-black/50 px-4 py-6 text-center backdrop-blur-sm">
              <div className="text-2xl md:text-3xl font-semibold tabular-nums text-white">
                {n.toLocaleString()}
                <span className="align-super text-base md:text-lg text-blue-400">{m.suffix || ""}</span>
              </div>
              <div className="mt-1 text-xs md:text-sm text-gray-300">{m.label}</div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function CTA() {
  return (
    <section className="max-w-5xl mx-auto px-6 md:px-8 py-16 md:py-20 mb-32 mt-32">
      <div className="rounded-xl border border-gray-700 bg-black/50 p-6 md:p-10 flex flex-col md:flex-row items-center gap-4 md:gap-6 backdrop-blur-sm">
        <div className="flex-1">
          <h2 className="text-balance text-2xl md:text-3xl font-semibold text-white">
            Ship production code from Figma in minutes
          </h2>
          <p className="mt-2 text-sm md:text-base text-gray-300">
            Skip boilerplate and focus on logic. Our engine respects your design system tokens.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => (window.location.href = "/api/auth/login")}
            className="px-5 py-3 rounded-md bg-white text-black border border-white text-sm md:text-base font-medium hover:bg-black hover:text-white transition"
          >
            Start Free
          </button>
          <a
            href="javascript:void(0)"
            className="px-5 py-3 rounded-md border border-white text-white text-sm md:text-base hover:bg-white hover:text-black transition"
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
    <footer className="border-t border-gray-800">
      <div className="max-w-6xl mx-auto px-6 md:px-8 py-8 md:py-10 text-sm text-gray-400 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="text-gray-500">© 2025 FigmaFlow. All rights reserved.</div>
        <nav className="flex items-center gap-6">
          <a className="hover:text-white transition-colors" href="#">
            Privacy Policy
          </a>
          <a className="hover:text-white transition-colors" href="#">
            Terms of Service
          </a>
          <a className="hover:text-white transition-colors" href="#">
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
  return (
    <div className="min-h-screen w-full bg-black text-white relative overflow-hidden">
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 0, pointerEvents: 'auto' }}>
        <Galaxy
          focal={[0.5, 0.5]}
          rotation={[1.0, 0.0]}
          starSpeed={0.5}
          density={2}
          hueShift={200}
          speed={1.0}
          mouseInteraction={true}
          glowIntensity={0.2}
          saturation={0.1}
          mouseRepulsion={true}
          repulsionStrength={2}
          twinkleIntensity={0.5}
          rotationSpeed={0.05}
          autoCenterRepulsion={0}
          transparent={false}
        />
      </div>
      <div className="relative" style={{ zIndex: 10 }}>
        
        <Hero />
        
        
        <CTA />
        <SiteFooter />
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <main className="bg-black text-white">
      <Home />
    </main>
  );
}
