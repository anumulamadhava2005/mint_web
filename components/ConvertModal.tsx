"use client"

import { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"

export default function ConvertModal(props: {
  open: boolean
  onClose: () => void
  onConfirm: (val: string) => void
}) {
  const { open, onClose, onConfirm } = props
  const [choice, setChoice] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    ref.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (!open) return null

  const FRAMEWORKS = [
    { id: "nextjs", label: "Next.js" },
    { id: "react", label: "React" },
    { id: "react-native", label: "React Native" },
    { id: "vue", label: "Vue" },
    { id: "svelte", label: "Svelte" },
    { id: "flutter", label: "Flutter" },
  ]

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50"
        aria-labelledby="convert-modal-title"
        role="dialog"
        aria-modal="true"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="absolute inset-0 bg-background/60 backdrop-blur"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        />
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <motion.div
            ref={ref}
            tabIndex={-1}
            className="w-full max-w-md rounded-xl bg-card shadow-lg border border-border outline-none"
            initial={{ y: 12, scale: 0.98, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 12, scale: 0.98, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <div className="px-4 py-3 border-b border-border">
              <h2 id="convert-modal-title" className="text-lg font-semibold text-foreground">
                Convert
              </h2>
            </div>

            <div className="p-4 space-y-3">
              <div>
                <div className="text-sm text-muted-foreground mb-1">Target framework</div>
                <div className="grid gap-2">
                  {FRAMEWORKS.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setChoice(c.id)}
                      className={`w-full text-left rounded-lg border px-3 py-2 transition-colors ${
                        choice === c.id
                          ? "border-primary ring-2 ring-primary/30 bg-primary/5"
                          : "border-border bg-card hover:bg-muted"
                      } text-foreground`}
                      aria-pressed={choice === c.id}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                Reference frame is chosen from the top toolbar and used during conversion.
              </div>
            </div>

            <div className="px-4 py-3 border-t border-border flex items-center justify-end gap-2">
              <button
                onClick={onClose}
                className="rounded-lg px-3 py-2 text-sm border border-border bg-card hover:bg-muted text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => choice && onConfirm(choice)}
                className="rounded-lg px-3 py-2 text-sm bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                disabled={!choice}
              >
                Convert
              </button>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
