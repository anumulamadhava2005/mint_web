"use client"

import { motion } from "framer-motion"


const features = [
  {
    title: "Fast Conversion",
    body: "Process full files in seconds without compromising fidelity.",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M13 10V3L4 14h7v7l9-11h-7z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: "Precise Output",
    body: "Preserves spacing, typography, and accessibility out of the box.",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="12" cy="12" r="9" />
      </svg>
    ),
  },
  {
    title: "Multiple Formats",
    body: "Export to React and HTML with clean, modern patterns.",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="4" width="7" height="7" rx="1" />
        <rect x="14" y="4" width="7" height="7" rx="1" />
        <rect x="3" y="15" width="7" height="7" rx="1" />
        <rect x="14" y="15" width="7" height="7" rx="1" />
      </svg>
    ),
  },
]

export function FeatureCards() {
  return (
    <div id="features" className="grid grid-cols-1 gap-5 md:grid-cols-3">
      {features.map((f, i) => (
        <motion.div
          key={f.title}
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ delay: i * 0.05, type: "spring", stiffness: 250, damping: 20 }}
          whileHover={{ y: -4, scale: 1.01 }}
        >
          <div className="h-full rounded-xl border border-gray-200 bg-white shadow-sm flex flex-col">
            <div className="flex flex-row items-center gap-3 px-4 pt-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-gray-100 text-gray-700">
                {f.icon}
              </div>
              <div className="text-base font-semibold text-gray-900">{f.title}</div>
            </div>
            <div className="px-4 pb-4 pt-2 text-sm text-gray-500 flex-1 leading-relaxed">{f.body}</div>
          </div>
        </motion.div>
      ))}
    </div>
  )
}
