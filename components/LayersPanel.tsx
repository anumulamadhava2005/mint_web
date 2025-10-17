"use client"

import React from "react"
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core"
import { arrayMove, SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical, ChevronRight, ChevronDown, Layers, Type, Box } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

// Helper to get icon based on layer type
const getLayerIcon = (type?: string) => {
  switch (type) {
    case "TEXT":
      return <Type size={14} className="opacity-60" />
    case "FRAME":
      return <Box size={14} className="opacity-60" />
    default:
      return <Box size={14} className="opacity-60" />
  }
}

type NodeInput = {
  id: string
  name?: string
  type?: string
  children?: NodeInput[]
}

// Helper function to get all child IDs recursively
const getAllChildIds = (node: NodeInput): string[] => {
  const ids: string[] = []
  if (node.children) {
    node.children.forEach((child) => {
      ids.push(child.id)
      ids.push(...getAllChildIds(child))
    })
  }
  return ids
}

// Helper function to get only direct child IDs (not recursive)
const getDirectChildIds = (node: NodeInput): string[] => {
  return node.children ? node.children.map(child => child.id) : []
}

interface LayersPanelProps {
  layers: NodeInput[]
  setLayers: (layers: NodeInput[]) => void
  selectedIds: Set<string>
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>
}

// Modern Sortable Layer Component
const SortableLayer: React.FC<{
  layer: NodeInput
  isSelected: boolean
  onSelect: (id: string) => void
  onDoubleClick: (id: string, childIds: string[]) => void
  expandedIds: Set<string>
  toggleExpanded: (id: string) => void
  selectedIds: Set<string>
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>
  isFirstFrame?: boolean
}> = ({ layer, isSelected, onSelect, onDoubleClick, expandedIds, toggleExpanded, selectedIds, setSelectedIds, isFirstFrame }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: layer.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const hasChildren = !!(layer.children && layer.children.length > 0)
  const isExpanded = expandedIds.has(layer.id)
  
  // Highlight children container when children are selected via dropdown arrow
  const hasSelectedChild = hasChildren && layer.children?.some(child => selectedIds.has(child.id))

  return (
    <motion.div ref={setNodeRef} style={style} layout className="mb-3 relative group">
      <div
        className={`
          flex items-center gap-1 px-2 py-1 transition-all duration-200 cursor-pointer relative z-10 rounded
          ${isDragging ? "opacity-50" : ""}
          ${isSelected 
            ? (isFirstFrame ? "bg-blue-800/60 text-white" : "bg-purple-700/60 text-white")
            : "text-gray-200 hover:bg-gray-600/40"
          }
        `}
        style={isSelected ? {
          border: '1px solid rgba(196, 181, 253, 0.4)'
        } : {}}
        onClick={(e) => {
          e.stopPropagation()
          onSelect(layer.id)
        }}
        onDoubleClick={(e) => {
          e.stopPropagation()
          // Disabled double-click selection for now - just expand/collapse
          if (hasChildren) {
            toggleExpanded(layer.id)
          }
        }}
      >
        <div
          {...attributes}
          {...listeners}
          className={`cursor-grab active:cursor-grabbing transition-all flex-shrink-0 ${isSelected ? 'opacity-70' : 'opacity-30 group-hover:opacity-100'}`}
          aria-label="Drag layer"
        >
          <GripVertical size={12} className={isSelected ? "text-white" : "text-gray-400"} />
        </div>

        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation()
              toggleExpanded(layer.id)
              // Only highlight children if NOT the first frame (Desktop)
              if (!isFirstFrame) {
                // When expanding, select all direct children to highlight them
                if (!isExpanded) {
                  const childIds = getDirectChildIds(layer)
                  setSelectedIds(new Set(childIds))
                } else {
                  // When collapsing, clear selection
                  setSelectedIds(new Set())
                }
              }
            }}
            className="hover:bg-white/10 rounded transition-all flex-shrink-0 w-4 h-4 flex items-center justify-center"
            aria-label={isExpanded ? "Collapse layer" : "Expand layer"}
          >
            <motion.div
              animate={{ rotate: isExpanded ? 0 : -90 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown size={12} className={isSelected ? "text-white" : "text-gray-400 group-hover:text-gray-300"} />
            </motion.div>
          </button>
        ) : (
          <div className="w-4 flex-shrink-0 flex items-center justify-center">
            <div className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-gray-500 group-hover:bg-gray-400'}`} />
          </div>
        )}

        <span className={`text-xs font-medium truncate flex-1 ${isSelected ? 'font-semibold' : ''}`}>
          {layer.name || "Untitled Layer"}
        </span>
      </div>

      {hasChildren && isExpanded && (
        <div className="ml-3 border-l border-gray-600 pl-3 mt-3">
          <div className={`${hasSelectedChild ? 'bg-purple-900/25 rounded py-0.5 px-1 -ml-0.25 space-y-1' : ''}`}>
            {layer.children!.map((child) => (
              <ChildLayer
                key={child.id}
                layer={child}
                isSelected={selectedIds.has(child.id)}
                onSelect={onSelect}
                onDoubleClick={onDoubleClick}
                expandedIds={expandedIds}
                toggleExpanded={toggleExpanded}
                selectedIds={selectedIds}
                setSelectedIds={setSelectedIds}
              />
            ))}
          </div>
        </div>
      )}
    </motion.div>
  )
}

// Modern Child Layer Component
const ChildLayer: React.FC<{
  layer: NodeInput
  isSelected: boolean
  onSelect: (id: string) => void
  onDoubleClick: (id: string, childIds: string[]) => void
  expandedIds: Set<string>
  toggleExpanded: (id: string) => void
  selectedIds: Set<string>
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>
}> = ({ layer, isSelected, onSelect, onDoubleClick, expandedIds, toggleExpanded, selectedIds, setSelectedIds }) => {
  const hasChildren = !!(layer.children && layer.children.length > 0)
  const isExpanded = expandedIds.has(layer.id)
  
  // Highlight children container when children are selected via dropdown arrow
  const hasSelectedChild = hasChildren && layer.children?.some(child => selectedIds.has(child.id))

  return (
    <div className="mb-2 relative group">
      <div
        className={`
          flex items-center gap-1 px-2 py-1 transition-all duration-200 cursor-pointer relative z-10 rounded
          ${isSelected 
            ? "bg-purple-700/60 text-white" 
            : "text-gray-200 hover:bg-gray-600/40"
          }
        `}
        style={isSelected ? {
          border: '1px solid rgba(196, 181, 253, 0.4)'
        } : {}}
        onClick={(e) => {
          e.stopPropagation()
          onSelect(layer.id)
        }}
        onDoubleClick={(e) => {
          e.stopPropagation()
          // Disabled double-click selection for now - just expand/collapse
          if (hasChildren) {
            toggleExpanded(layer.id)
          }
        }}
      >
        <div className="w-2 flex-shrink-0">
          {!hasChildren && (
            <div className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-gray-500'}`} />
          )}
        </div>

        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation()
              toggleExpanded(layer.id)
              // When expanding, select all direct children to highlight them
              if (!isExpanded) {
                const childIds = getDirectChildIds(layer)
                setSelectedIds(new Set(childIds))
              } else {
                // When collapsing, clear selection
                setSelectedIds(new Set())
              }
            }}
            className="hover:bg-white/10 rounded transition-all flex-shrink-0 w-3 h-3 flex items-center justify-center"
            aria-label={isExpanded ? "Collapse layer" : "Expand layer"}
          >
            <motion.div
              animate={{ rotate: isExpanded ? 0 : -90 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown size={10} className={isSelected ? "text-white" : "text-gray-400 group-hover:text-gray-300"} />
            </motion.div>
          </button>
        ) : (
          <div className="w-3 flex-shrink-0" />
        )}

        <span className={`text-xs font-medium truncate flex-1 ${isSelected ? 'font-semibold' : ''}`}>
          {layer.name || "Untitled Layer"}
        </span>
      </div>

      {hasChildren && isExpanded && (
        <div className="ml-3 border-l border-gray-600 pl-3 mt-3">
          <div className={`${hasSelectedChild ? 'bg-purple-900/25 rounded py-0.5 px-1 -ml-0.25 space-y-1' : ''}`}>
            {layer.children!.map((child) => (
              <ChildLayer
                key={child.id}
                layer={child}
                isSelected={selectedIds.has(child.id)}
                onSelect={onSelect}
                onDoubleClick={onDoubleClick}
                expandedIds={expandedIds}
                toggleExpanded={toggleExpanded}
                selectedIds={selectedIds}
                setSelectedIds={setSelectedIds}
              />
            ))}
          </div>
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

  const handleDoubleClick = (parentId: string, childIds: string[]) => {
    // Double-click is disabled for now - only expands/collapses
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

  if (!layers || layers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 blur-2xl rounded-full" />
          <Layers size={48} className="text-gray-600 mb-4 relative z-10" />
        </div>
        <p className="text-sm text-gray-400 font-medium">No layers available</p>
        <p className="text-xs text-gray-500 mt-1">Create or import layers to get started</p>
      </div>
    )
  }

  const handleContainerClick = (e: React.MouseEvent) => {
    // Clear selection if clicking on empty space (not on any layer)
    if (e.target === e.currentTarget) {
      setSelectedIds(new Set())
    }
  }

  return (
    <div className="py-1" onClick={handleContainerClick}>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={layers} strategy={verticalListSortingStrategy}>
          <div className="space-y-0">
            {layers.map((layer, index) => (
              <SortableLayer
                key={layer.id}
                layer={layer}
                isSelected={selectedIds.has(layer.id)}
                onSelect={handleSelect}
                onDoubleClick={handleDoubleClick}
                expandedIds={expandedIds}
                toggleExpanded={toggleExpanded}
                selectedIds={selectedIds}
                setSelectedIds={setSelectedIds}
                isFirstFrame={index === 0}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}

export default LayersPanel
