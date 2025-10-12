/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useState } from "react"
import type { NodeInput } from "../lib/figma-types"
import { motion, AnimatePresence } from "framer-motion"
import styles from "./css/CollapsibleNodeItem.module.css"

function CollapsibleNodeItem({
  node,
  selectedIds,
  onSelect,
}: {
  node: NodeInput
  selectedIds: Set<string>
  onSelect: (id: string, isMulti: boolean) => void
}) {
  const isSelected = selectedIds.has(node.id)
  const hasChildren = node.children && node.children.length > 0
  const [isExpanded, setIsExpanded] = useState(true)

  return (
    <div>
      <div
        className={`${styles.item} ${isSelected ? styles.itemSelected : `${styles.itemDefault} ${styles.itemHover}`}`}
        onClick={(e) => onSelect(node.id, e.ctrlKey || e.metaKey)}
      >
        {hasChildren && (
          <motion.span
            onClick={(e) => {
              e.stopPropagation()
              setIsExpanded(!isExpanded)
            }}
            className={styles.twist}
            animate={{ rotate: isExpanded ? 90 : 0 }}
          >
            ▶
          </motion.span>
        )}
        <span className={styles.name}>{node.name || `[${node.type}]`}</span>
      </div>

      <AnimatePresence initial={false}>
        {hasChildren && isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className={styles.children}
          >
            {node.children!.map((child) => (
              <CollapsibleNodeItem key={child.id} node={child} selectedIds={selectedIds} onSelect={onSelect} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
