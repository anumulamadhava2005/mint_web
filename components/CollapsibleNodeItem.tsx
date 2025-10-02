/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useState } from "react"
import type { NodeInput } from "../lib/figma-types"
import { motion, AnimatePresence } from "framer-motion"

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
        className={`py-1 px-2 cursor-pointer rounded text-xs truncate flex items-center gap-2 transition-colors ${
          isSelected ? "bg-primary text-primary-foreground font-medium" : "hover:bg-muted"
        }`}
        onClick={(e) => onSelect(node.id, e.ctrlKey || e.metaKey)}
      >
        {hasChildren && (
          <motion.span
            onClick={(e) => {
              e.stopPropagation()
              setIsExpanded(!isExpanded)
            }}
            className="transition-transform"
            animate={{ rotate: isExpanded ? 90 : 0 }}
          >
            ▶
          </motion.span>
        )}
        <span className="flex-1 min-w-0 text-foreground">{node.name || `[${node.type}]`}</span>
      </div>

      <AnimatePresence initial={false}>
        {hasChildren && isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="pl-4 border-l border-border"
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
