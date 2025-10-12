"use client"

import React from "react"
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core"
import { arrayMove, SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical, ChevronRight, ChevronDown } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

type NodeInput = {
  id: string
  name?: string
  type?: string
  children?: NodeInput[]
}

interface LayersPanelProps {
  layers: NodeInput[]
  setLayers: (layers: NodeInput[]) => void
  selectedIds: Set<string>
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>
}

// Separate sortable wrapper component
const SortableLayer: React.FC<{
  layer: NodeInput
  isSelected: boolean
  onSelect: (id: string) => void
  expandedIds: Set<string>
  toggleExpanded: (id: string) => void
  selectedIds: Set<string>
}> = ({ layer, isSelected, onSelect, expandedIds, toggleExpanded, selectedIds }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: layer.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const hasChildren = !!(layer.children && layer.children.length > 0)
  const isExpanded = expandedIds.has(layer.id)

  return (
    <motion.div ref={setNodeRef} style={style} layout className="mb-1">
      <div
        className={[
          "flex items-center gap-2 px-2 py-1.5 rounded-md border-2 shadow-[3px_3px_0_0_#000] transition-all",
          isSelected ? "bg-red-600 text-white border-black" : "bg-white text-black border-black hover:-translate-y-0.5",
        ].join(" ")}
        onClick={(e) => {
          e.stopPropagation()
          onSelect(layer.id)
        }}
      >
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab p-1 rounded hover:bg-black/5"
          aria-label="Drag layer"
        >
          <GripVertical size={14} className="text-black/70" />
        </div>

        {hasChildren && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              toggleExpanded(layer.id)
            }}
            className="p-1 rounded hover:bg-black/5"
            aria-label={isExpanded ? "Collapse layer" : "Expand layer"}
          >
            {isExpanded ? (
              <ChevronDown size={14} className="text-black/70" />
            ) : (
              <ChevronRight size={14} className="text-black/70" />
            )}
          </button>
        )}

        {!hasChildren && <div className="w-4" />}

        <span className="text-sm font-semibold tracking-tight">{layer.name || "Untitled Layer"}</span>
      </div>

      <AnimatePresence initial={false}>
        {hasChildren && isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0, scale: 0.98 }}
            animate={{ height: "auto", opacity: 1, scale: 1 }}
            exit={{ height: 0, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            className="ml-5 pl-3 border-l-2 border-black/20 space-y-1"
          >
            {layer.children!.map((child) => (
              <ChildLayer
                key={child.id}
                layer={child}
                isSelected={selectedIds.has(child.id)}
                onSelect={onSelect}
                expandedIds={expandedIds}
                toggleExpanded={toggleExpanded}
                selectedIds={selectedIds}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// Non-sortable child layer component
const ChildLayer: React.FC<{
  layer: NodeInput
  isSelected: boolean
  onSelect: (id: string) => void
  expandedIds: Set<string>
  toggleExpanded: (id: string) => void
  selectedIds: Set<string>
}> = ({ layer, isSelected, onSelect, expandedIds, toggleExpanded, selectedIds }) => {
  const hasChildren = !!(layer.children && layer.children.length > 0)
  const isExpanded = expandedIds.has(layer.id)

  return (
    <div className="mb-1">
      <div
        className={[
          "ml-1 flex items-center gap-2 px-2 py-1.5 rounded-md border-2 shadow-[3px_3px_0_0_#000] transition-all",
          isSelected
            ? "bg-red-600 text-white border-black"
            : "bg-amber-50 text-black border-black hover:-translate-y-0.5",
        ].join(" ")}
        onClick={(e) => {
          e.stopPropagation()
          onSelect(layer.id)
        }}
      >
        <div className="w-4" />

        {hasChildren && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              toggleExpanded(layer.id)
            }}
            className="p-1 rounded hover:bg-black/5"
            aria-label={isExpanded ? "Collapse layer" : "Expand layer"}
          >
            {isExpanded ? (
              <ChevronDown size={14} className="text-black/70" />
            ) : (
              <ChevronRight size={14} className="text-black/70" />
            )}
          </button>
        )}

        {!hasChildren && <div className="w-4" />}

        <span className="text-sm font-semibold tracking-tight">{layer.name || "Untitled Layer"}</span>
      </div>

      {hasChildren && isExpanded && (
        <div className="ml-6 pl-3 border-l-2 border-black/20 space-y-1">
          {layer.children!.map((child) => (
            <ChildLayer
              key={child.id}
              layer={child}
              isSelected={selectedIds.has(child.id)}
              onSelect={onSelect}
              expandedIds={expandedIds}
              toggleExpanded={toggleExpanded}
              selectedIds={selectedIds}
            />
          ))}
        </div>
      )}
    </div>
  )
}

const LayersPanel: React.FC<LayersPanelProps> = ({ layers, setLayers, selectedIds, setSelectedIds }) => {
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(new Set())
  const sensors = useSensors(useSensor(PointerSensor))

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = layers.findIndex((item) => item.id === active.id)
      const newIndex = layers.findIndex((item) => item.id === over.id)
      setLayers(arrayMove(layers, oldIndex, newIndex))
    }
  }

  const handleSelect = (id: string) => {
    setSelectedIds(new Set([id]))
  }

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  return (
    <div className="p-2">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={layers} strategy={verticalListSortingStrategy}>
          <div className="space-y-1">
            {layers.map((layer) => (
              <SortableLayer
                key={layer.id}
                layer={layer}
                isSelected={selectedIds.has(layer.id)}
                onSelect={handleSelect}
                expandedIds={expandedIds}
                toggleExpanded={toggleExpanded}
                selectedIds={selectedIds}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}

export default LayersPanel
