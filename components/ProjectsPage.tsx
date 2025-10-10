"use client"

import { useState, useEffect, useRef } from "react"
import { motion, useAnimation, Variants } from "framer-motion"

// Animation variants
const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

const staggerContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
}

const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1 },
}

// Types
type Project = {
  id: string
  name: string
  fileKey: string
  thumbnail?: string
  lastModified: string
  frameCount: number
  rawRoots?: any
}

function SiteNav({ user }: { user: any }) {
  return (
    <header className="sticky top-0 z-30 bg-white border-b-4 border-black backdrop-blur-sm bg-opacity-95 shadow-[8px_8px_0_0_#000]">
      <nav className="flex w-full items-center justify-between py-3 px-6 md:px-8 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="h-9 w-9 rounded-sm bg-amber-400 ring-2 ring-black flex items-center justify-center shadow-[4px_4px_0_0_#000]"
          >
            <span className="h-4 w-4 rounded-[2px] bg-black block" />
          </span>
          <span className="text-base md:text-lg font-extrabold tracking-tight">FigmaFlow</span>
        </div>
        <div className="flex items-center gap-4">
          {user && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-black/70 hidden md:block">{user.email || user.name}</span>
              <div className="h-9 w-9 rounded-full bg-red-600 text-white ring-2 ring-black flex items-center justify-center shadow-[3px_3px_0_0_#000]">
                <span className="text-xs font-extrabold">
                  {(user.name || user.email || "U").charAt(0).toUpperCase()}
                </span>
              </div>
            </div>
          )}
        </div>
      </nav>
    </header>
  )
}

function CreateProjectModal({
  isOpen,
  onClose,
  onCreate,
}: { isOpen: boolean; onClose: () => void; onCreate: (name: string, url: string) => void }) {
  const [projectName, setProjectName] = useState("")
  const [figmaUrl, setFigmaUrl] = useState("")
  const [isCreating, setIsCreating] = useState(false)

  const handleCreate = async () => {
    if (!projectName.trim() || !figmaUrl.trim()) return
    setIsCreating(true)
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 800))
    onCreate(projectName, figmaUrl)
    setIsCreating(false)
    setProjectName("")
    setFigmaUrl("")
    onClose()
  }

  if (!isOpen) return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        variants={scaleIn}
        initial="hidden"
        animate="visible"
        className="bg-white rounded-lg border-4 border-black shadow-[10px_10px_0_0_#000] max-w-md w-full mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b-4 border-black bg-amber-400">
          <h2 className="text-xl font-extrabold">Create New Project</h2>
          <p className="text-sm text-black/80 mt-1">Import a Figma file to get started</p>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-extrabold mb-2">Project Name</label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="My Awesome Project"
              className="w-full px-4 py-2.5 border-2 border-black rounded-md focus:outline-none focus:ring-2 focus:ring-red-600 transition-all shadow-[4px_4px_0_0_#000]"
            />
          </div>

          <div>
            <label className="block text-sm font-extrabold mb-2">Figma File URL</label>
            <input
              type="text"
              value={figmaUrl}
              onChange={(e) => setFigmaUrl(e.target.value)}
              placeholder="https://figma.com/file/..."
              className="w-full px-4 py-2.5 border-2 border-black rounded-md focus:outline-none focus:ring-2 focus:ring-red-600 transition-all shadow-[4px_4px_0_0_#000]"
            />
            <p className="text-xs text-black/70 mt-1.5">Paste your Figma file URL or key</p>
          </div>
        </div>

        <div className="p-6 bg-stone-100 border-t-2 border-black flex gap-3 justify-end">
          <button
            onClick={onClose}
            disabled={isCreating}
            className="px-5 py-2.5 rounded-md border-2 border-black text-sm font-extrabold bg-white hover:-translate-y-0.5 transition disabled:opacity-50 shadow-[4px_4px_0_0_#000]"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!projectName.trim() || !figmaUrl.trim() || isCreating}
            className="px-5 py-2.5 rounded-md bg-red-600 text-white border-2 border-black text-sm font-extrabold hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-[4px_4px_0_0_#000]"
          >
            {isCreating && (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            )}
            {isCreating ? "Creating..." : "Create Project"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

function ProjectCard({ project, onOpen, onDelete }: { project: any; onOpen: () => void; onDelete: () => void }) {
  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const formatDate = (input: string | number | Date | null | undefined) => {
    const date = input instanceof Date ? input : input ? new Date(input) : null
    if (!date || isNaN(date.getTime())) return "Unknown date"
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return "Today"
    if (diffDays === 1) return "Yesterday"
    if (diffDays < 7) return `${diffDays} days ago`
    return date.toLocaleDateString()
  }

  return (
    <motion.div
      variants={fadeInUp}
      whileHover={{ y: -6, rotate: -0.25, transition: { duration: 0.2 } }}
      className="group relative bg-white rounded-lg border-4 border-black overflow-hidden shadow-[8px_8px_0_0_#000] hover:shadow-[10px_10px_0_0_#000] transition-all cursor-pointer"
      onClick={onOpen}
    >
      <div className="aspect-[4/3] bg-stone-100 overflow-hidden border-b-2 border-black">
        <img
          src={project.thumbnail || "/placeholder.svg"}
          alt={project.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-extrabold text-base truncate">{project.name}</h3>
            <p className="text-sm text-black/70 mt-1">{project.frameCount} frames</p>
            <p className="text-xs text-black/60 mt-1">{formatDate(project.lastModified)}</p>
          </div>

          <div className="relative" ref={menuRef}>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowMenu(!showMenu)
              }}
              className="p-1.5 rounded-md border-2 border-black bg-white hover:bg-black/5 transition-colors shadow-[3px_3px_0_0_#000]"
            >
              <svg
                className="h-5 w-5 text-black"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                aria-hidden="true"
              >
                <circle cx="12" cy="5" r="2" />
                <circle cx="12" cy="12" r="2" />
                <circle cx="12" cy="19" r="2" />
              </svg>
              <span className="sr-only">Project menu</span>
            </button>

            {showMenu && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="absolute right-0 top-full mt-1 w-40 bg-white rounded-md shadow-[6px_6px_0_0_#000] border-2 border-black py-1 z-10"
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onOpen()
                  }}
                  className="w-full px-4 py-2 text-left text-sm font-semibold hover:bg-amber-50 transition-colors"
                >
                  Open
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowMenu(false)
                    onDelete()
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-red-700 hover:bg-red-50 transition-colors"
                >
                  Delete
                </button>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col items-center justify-center py-20 px-4"
    >
      <div className="w-24 h-24 rounded-md bg-amber-400 border-4 border-black flex items-center justify-center mb-6 shadow-[6px_6px_0_0_#000]">
        <svg className="h-10 w-10 text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2.5"
            d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <span className="sr-only">Create project</span>
      </div>
      <h3 className="text-2xl font-extrabold mb-2">No projects yet</h3>
      <p className="text-black/70 text-center mb-6 max-w-md">
        Create your first project by importing a Figma file and start converting designs to code
      </p>
      <button
        onClick={onCreate}
        className="px-6 py-3 rounded-md bg-red-600 text-white font-extrabold border-2 border-black hover:bg-red-700 transition-colors shadow-[5px_5px_0_0_#000]"
      >
        Create Your First Project
      </button>
    </motion.div>
  )
}

export function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const controls = useAnimation()

  // Load projects from in-memory state on mount
  useEffect(() => {
    loadProjects()
    fetchUser()
    controls.start("visible")
  }, [controls])

  // Fetch current user
  async function fetchUser() {
    try {
      const res = await fetch("/api/figma/me")
      const data = await res.json()
      if (!data.error) {
        setUser(data)
      }
    } catch (e) {
      console.error("Failed to fetch user:", e)
    }
  }

  // Load saved projects from in-memory state
  function loadProjects() {
    setLoading(true)
    try {
      const stored = localStorage.getItem("figma-projects")
      if (stored) {
        const projects = JSON.parse(stored)
        setProjects(projects)
      } else {
        setProjects([])
      }
    } catch (e) {
      console.error("Failed to load projects:", e)
      setProjects([])
    } finally {
      setLoading(false)
    }
  }

  // Save projects to in-memory state
  function saveProjectsToMemory(updatedProjects: Project[]) {
    try {
      localStorage.setItem("figma-projects", JSON.stringify(updatedProjects))
    } catch (e) {
      console.warn("Failed to save projects:", e)
    }
  }

  // Save project to state
  function saveProject(project: Project) {
    const updatedProjects = [project, ...projects]
    setProjects(updatedProjects)
    saveProjectsToMemory(updatedProjects)
  }

  // Delete project from state
  function deleteProject(id: string) {
    const updatedProjects = projects.filter((p) => p.id !== id)
    setProjects(updatedProjects)
    saveProjectsToMemory(updatedProjects)
  }

  const filteredProjects = projects.filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()))

  const handleCreateProject = async (name: string, figmaUrl: string) => {
    setError(null)

    try {
      // Fetch Figma file to get frame data
      const res = await fetch(`/api/figma/frames?fileUrl=${encodeURIComponent(figmaUrl)}`)

      if (!res.ok) {
        let errorMessage = "Failed to load Figma file"
        try {
          const errorData = await res.json()
          errorMessage = errorData?.error || errorData?.err || errorMessage
        } catch {
          errorMessage = (await res.text()) || errorMessage
        }
        setError(errorMessage)
        return
      }

      const data = await res.json()
      let roots: any[] = []
      let fileKey = ""
      let fileName = name

      // Parse response to extract roots and metadata
      if ("extracted" in data && Array.isArray(data.extracted)) {
        roots = data.extracted
        if (data.raw?.name) fileName = data.raw.name
        if (data.raw?.key) fileKey = data.raw.key
      } else if ("frames" in data && Array.isArray(data.frames)) {
        roots = data.frames
        if (data.fileName) fileName = data.fileName
        if (data.fileKey) fileKey = data.fileKey
      } else if ("document" in data && data.document?.children) {
        roots = data.document.children
        if (data.fileName) fileName = data.fileName
        if (data.fileKey) fileKey = data.fileKey
      }

      if (!roots || roots.length === 0) {
        setError("No frames found in the Figma file")
        return
      }

      // Extract file key from URL if not provided
      if (!fileKey) {
        const match = figmaUrl.match(/figma\.com\/file\/([a-zA-Z0-9]{20,})/)
        fileKey = match ? match[1] : figmaUrl
      }

      // Count total frames
      const countFrames = (nodes: any[]): number => {
        let count = 0
        nodes.forEach((node) => {
          if (node.type === "FRAME" || node.type === "COMPONENT") count++
          if (node.children) count += countFrames(node.children)
        })
        return count
      }

      const newProject: Project = {
        id: `project_${Date.now()}`,
        name: fileName || name,
        fileKey,
        lastModified: new Date().toISOString(),
        frameCount: countFrames(roots),
        rawRoots: roots,
      }

      saveProject(newProject)
    } catch (e: any) {
      setError(e?.message || "Failed to create project")
      console.error("Create project error:", e)
    }
  }

  const handleDeleteProject = (id: string) => {
    if (confirm("Are you sure you want to delete this project?")) {
      deleteProject(id)
    }
  }

  const handleOpenProject = (project: Project) => {
    // Store project data in sessionStorage for editor to load
    try {
      sessionStorage.setItem(
        "currentProject",
        JSON.stringify({
          id: project.id,
          name: project.name,
          fileKey: project.fileKey,
          rawRoots: project.rawRoots,
        }),
      )
    } catch (e) {
      console.warn("SessionStorage not available, using window object")
      ;(window as any).__currentProject = {
        id: project.id,
        name: project.name,
        fileKey: project.fileKey,
        rawRoots: project.rawRoots,
      }
    }

    // Navigate to editor
    window.location.href = `/#project=${project.id}`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-black"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <SiteNav user={user} />

      <main className="max-w-7xl mx-auto px-6 md:px-8 py-8 md:py-12">
        <motion.div variants={staggerContainer} initial="hidden" animate={controls}>
          {/* Error Banner */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 bg-red-50 border-4 border-black rounded-md text-red-800 text-sm shadow-[6px_6px_0_0_#000]"
            >
              {error}
              <button
                onClick={() => setError(null)}
                className="float-right text-red-700 font-extrabold"
                aria-label="Dismiss error"
                title="Dismiss"
              >
                ✕
              </button>
            </motion.div>
          )}

          {/* Header */}
          <motion.div
            variants={fadeInUp}
            className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8"
          >
            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">My Projects</h1>
              <p className="text-black/70 mt-2">Manage and organize your Figma conversions</p>
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-5 py-3 rounded-md bg-red-600 text-white font-extrabold border-2 border-black hover:bg-red-700 transition-colors flex items-center gap-2 justify-center md:justify-start shadow-[5px_5px_0_0_#000]"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
              </svg>
              New Project
            </button>
          </motion.div>

          {/* Search Bar */}
          {projects.length > 0 && (
            <motion.div variants={fadeInUp} className="mb-8">
              <div className="relative max-w-md">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-black"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <circle cx="11" cy="11" r="8" strokeWidth="2.5" />
                  <path d="M21 21l-4.35-4.35" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search projects..."
                  className="w-full pl-10 pr-4 py-3 border-2 border-black rounded-md focus:outline-none focus:ring-2 focus:ring-red-600 transition-all shadow-[4px_4px_0_0_#000] font-semibold"
                />
              </div>
            </motion.div>
          )}

          {/* Projects Grid */}
          {filteredProjects.length === 0 && projects.length === 0 ? (
            <EmptyState onCreate={() => setIsModalOpen(true)} />
          ) : filteredProjects.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12">
              <p className="text-black/70">No projects found matching "{searchQuery}"</p>
            </motion.div>
          ) : (
            <motion.div variants={staggerContainer} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onOpen={() => handleOpenProject(project)}
                  onDelete={() => handleDeleteProject(project.id)}
                />
              ))}
            </motion.div>
          )}
        </motion.div>
      </main>

      <CreateProjectModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onCreate={handleCreateProject} />
    </div>
  )
}
