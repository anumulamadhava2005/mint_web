"use client"

import { motion } from "framer-motion"
// Fallback Button if ui/button does not exist
function Button({ children, className = "", ...props }: any) {
  return <button className={`px-5 md:px-6 py-3 rounded-md bg-primary text-primary-foreground text-sm md:text-base font-medium hover:opacity-90 transition ${className}`} {...props}>{children}</button>;
}
import Link from "next/link"

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
}

const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { stiffness: 300, damping: 22 } },
}

const words = ["Turn", "Figma", "designs", "into", "clean,", "production", "code"]

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* decorative orbs without gradients; using borders + opacity to stay on brand tokens */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -left-16 -top-20 h-44 w-44 rounded-full border border-border/70" />
        <div className="absolute right-10 top-12 h-32 w-32 rounded-full border border-border/60" />
        <div className="absolute -right-20 bottom-0 h-56 w-56 rounded-full border border-border/40" />
      </div>

      <div className="mx-auto flex max-w-6xl flex-col items-center px-6 md:px-8 py-16 md:py-28">
        <motion.div variants={container} initial="hidden" animate="show" className="text-center">
          <motion.div
            variants={item}
            className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground"
          >
            <span className="inline-block h-2 w-2 rounded-full bg-primary" />
            Built for modern teams
          </motion.div>

          <h1 className="text-balance text-4xl leading-tight font-semibold md:text-6xl md:leading-tight">
            <span className="sr-only">{"Turn Figma designs into clean, production code"}</span>
            <motion.span variants={container} className="inline-block">
              {words.map((w, i) => (
                <motion.span key={i} variants={item} className="inline-block mr-2">
                  {w}
                </motion.span>
              ))}
            </motion.span>
          </h1>

          <motion.p
            variants={item}
            className="mx-auto mt-5 max-w-2xl text-pretty text-muted-foreground md:text-lg leading-relaxed"
          >
            Transform entire files in seconds while preserving layout, spacing, and semantics. Opinionated, accessible,
            and production-ready.
          </motion.p>

          <motion.div variants={item} className="mt-8 flex items-center justify-center gap-3">
            <Button size="lg" asChild>
              <Link href="/api/auth/login">Get started</Link>
            </Button>
            <Button size="lg" variant="secondary" asChild>
              <Link href="#features">See features</Link>
            </Button>
          </motion.div>
        </motion.div>

        {/* floating badges */}
        <div className="relative mt-14 grid w-full grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { label: "Precise Output" },
            { label: "Multiple Formats" },
            { label: "Accessible by Default" },
            { label: "Fast Conversion" },
          ].map((b, i) => (
            <motion.div
              key={b.label}
              initial={{ y: 8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.25 + i * 0.08, type: "spring", stiffness: 220, damping: 20 }}
              className="rounded-lg border border-border bg-card p-4 text-center text-sm"
            >
              {b.label}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
