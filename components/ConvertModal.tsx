"use client"

import { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import styles from "./css/ConvertModal.module.css"

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
        className={styles.overlayRoot}
        aria-labelledby="convert-modal-title"
        role="dialog"
        aria-modal="true"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className={styles.backdrop}
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        />
        <div className={styles.center}>
          <motion.div
            ref={ref}
            tabIndex={-1}
            className={styles.card}
            initial={{ y: 12, scale: 0.98, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 12, scale: 0.98, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <div className={styles.header}>
              <h2 id="convert-modal-title" className={styles.title}>
                Convert
              </h2>
            </div>

            <div className={styles.content}>
              <div>
                <div className={styles.label}>Target framework</div>
                <div className={styles.grid}>
                  {FRAMEWORKS.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setChoice(c.id)}
                      className={`${styles.choice} ${choice === c.id ? styles.choiceActive : ""}`}
                      aria-pressed={choice === c.id}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.hint}>
                Reference frame is chosen from the top toolbar and used during conversion.
              </div>
            </div>

            <div className={styles.footer}>
              <button
                onClick={onClose}
                className={`${styles.btn} ${styles.btnGhost}`}
              >
                Cancel
              </button>
              <button
                onClick={() => choice && onConfirm(choice)}
                className={`${styles.btn} ${styles.btnPrimary}`}
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
