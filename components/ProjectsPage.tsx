"use client";
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

// PixelCard Component
class Pixel {
  width: number;
  height: number;
  ctx: CanvasRenderingContext2D;
  x: number;
  y: number;
  color: string;
  speed: number;
  size: number;
  sizeStep: number;
  minSize: number;
  maxSizeInteger: number;
  maxSize: number;
  delay: number;
  counter: number;
  counterStep: number;
  isIdle: boolean;
  isReverse: boolean;
  isShimmer: boolean;

  constructor(
    canvas: HTMLCanvasElement,
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    color: string,
    speed: number,
    delay: number
  ) {
    this.width = canvas.width;
    this.height = canvas.height;
    this.ctx = context;
    this.x = x;
    this.y = y;
    this.color = color;
    this.speed = this.getRandomValue(0.1, 0.9) * speed;
    this.size = 0;
    this.sizeStep = Math.random() * 0.4;
    this.minSize = 0.5;
    this.maxSizeInteger = 2;
    this.maxSize = this.getRandomValue(this.minSize, this.maxSizeInteger);
    this.delay = delay;
    this.counter = 0;
    this.counterStep = Math.random() * 4 + (this.width + this.height) * 0.01;
    this.isIdle = false;
    this.isReverse = false;
    this.isShimmer = false;
  }

  getRandomValue(min: number, max: number): number {
    return Math.random() * (max - min) + min;
  }

  draw() {
    const centerOffset = this.maxSizeInteger * 0.5 - this.size * 0.5;
    this.ctx.fillStyle = this.color;
    this.ctx.fillRect(this.x + centerOffset, this.y + centerOffset, this.size, this.size);
  }

  appear() {
    this.isIdle = false;
    if (this.counter <= this.delay) {
      this.counter += this.counterStep;
      return;
    }
    if (this.size >= this.maxSize) {
      this.isShimmer = true;
    }
    if (this.isShimmer) {
      this.shimmer();
    } else {
      // Smooth acceleration for more responsive feel
      const acceleration = 1.2;
      this.size += this.sizeStep * acceleration;
    }
    this.draw();
  }

  disappear() {
    this.isShimmer = false;
    this.counter = 0;
    if (this.size <= 0) {
      this.isIdle = true;
      this.size = 0; // Ensure it doesn't go negative
      return;
    } else {
      // Faster disappearance for snappier feel
      const disappearSpeed = 0.15;
      this.size -= disappearSpeed;
    }
    this.draw();
  }

  shimmer() {
    if (this.size >= this.maxSize) {
      this.isReverse = true;
    } else if (this.size <= this.minSize) {
      this.isReverse = false;
    }
    if (this.isReverse) {
      this.size -= this.speed * 0.3; // Slower shimmer for smoother effect
    } else {
      this.size += this.speed * 0.3;
    }
  }
}

function getEffectiveSpeed(value: number | string, reducedMotion: boolean): number {
  const min = 0;
  const max = 100;
  const throttle = 0.01; // Increased from 0.001 for much faster animations
  const parsed = parseInt(value.toString(), 10);

  if (parsed <= min || reducedMotion) {
    return min;
  } else if (parsed >= max) {
    return max * throttle;
  } else {
    return parsed * throttle;
  }
}

interface PixelCardProps {
  variant?: 'default' | 'blue' | 'yellow' | 'pink' | 'red';
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
}

function PixelCard({ variant = 'default', className = '', children, onClick }: PixelCardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pixelsRef = useRef<Pixel[]>([]);
  const animationRef = useRef<number | null>(null);
  const timePreviousRef = useRef(performance.now());
  const reducedMotion = useRef(window.matchMedia('(prefers-reduced-motion: reduce)').matches).current;
  const lastAnimationTime = useRef(0);

  const VARIANTS = {
    default: { gap: 4, speed: 350, colors: '#f8fafc,#f1f5f9,#cbd5e1' },
    blue: { gap: 6, speed: 250, colors: '#e0f2fe,#7dd3fc,#0ea5e9' },
    yellow: { gap: 3, speed: 200, colors: '#fef08a,#fde047,#eab308' },
    pink: { gap: 5, speed: 800, colors: '#fecdd3,#fda4af,#e11d48' },
    red: { gap: 4, speed: 400, colors: '#fee2e2,#fca5a5,#dc2626' }
  };

  const variantCfg = VARIANTS[variant] || VARIANTS.default;

  const initPixels = () => {
    if (!containerRef.current || !canvasRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const width = Math.floor(rect.width);
    const height = Math.floor(rect.height);
    const ctx = canvasRef.current.getContext('2d');

    canvasRef.current.width = width;
    canvasRef.current.height = height;
    canvasRef.current.style.width = `${width}px`;
    canvasRef.current.style.height = `${height}px`;

    const colorsArray = variantCfg.colors.split(',');
    const pxs = [];
    for (let x = 0; x < width; x += variantCfg.gap) {
      for (let y = 0; y < height; y += variantCfg.gap) {
        const color = colorsArray[Math.floor(Math.random() * colorsArray.length)];
        const dx = x - width / 2;
        const dy = y - height / 2;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const delay = reducedMotion ? 0 : Math.min(distance * 0.5, 1000); // Cap delay to prevent too long waits
        if (canvasRef.current && ctx) {
          pxs.push(new Pixel(canvasRef.current, ctx, x, y, color, getEffectiveSpeed(variantCfg.speed, reducedMotion), delay));
        }
      }
    }
    pixelsRef.current = pxs;
  };

  const doAnimate = (fnName: keyof Pixel) => {
    animationRef.current = requestAnimationFrame(() => doAnimate(fnName));
    const timeNow = performance.now();
    const timePassed = timeNow - timePreviousRef.current;

    // Remove FPS cap for smoother animations - let browser optimize
    // const timeInterval = 1000 / 60;
    // if (timePassed < timeInterval) return;
    // timePreviousRef.current = timeNow - (timePassed % timeInterval);

    // Use delta time for consistent animation speed across different frame rates
    const deltaTime = Math.min(timePassed, 16.67); // Cap at ~60ms to prevent large jumps
    timePreviousRef.current = timeNow;

    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || !canvasRef.current) return;

    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

    let allIdle = true;
    for (let i = 0; i < pixelsRef.current.length; i++) {
      const pixel = pixelsRef.current[i];
      if (fnName === 'appear' && typeof pixel.appear === 'function') {
        pixel.appear();
      } else if (fnName === 'disappear' && typeof pixel.disappear === 'function') {
        pixel.disappear();
      }
      if (!pixel.isIdle) {
        allIdle = false;
      }
    }

    // Only stop animation when ALL pixels are idle
    if (allIdle) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    }
  };

  const handleAnimation = (name: keyof Pixel) => {
    // Cancel any existing animation to prevent conflicts
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    // Reset pixel states for clean animation start
    pixelsRef.current.forEach(pixel => {
      if (name === 'appear') {
        pixel.isIdle = false;
        pixel.isShimmer = false;
        pixel.counter = 0;
        pixel.size = 0;
      } else if (name === 'disappear') {
        pixel.isShimmer = false;
        pixel.counter = 0;
      }
    });

    // Start new animation immediately
    animationRef.current = requestAnimationFrame(() => doAnimate(name));
  };

  const onMouseEnter = () => {
    const now = performance.now();
    if (now - lastAnimationTime.current > 50) { // Prevent animations more frequent than 20ms
      lastAnimationTime.current = now;
      handleAnimation('appear');
    }
  };

  const onMouseLeave = () => {
    const now = performance.now();
    if (now - lastAnimationTime.current > 50) {
      lastAnimationTime.current = now;
      handleAnimation('disappear');
    }
  };

  useEffect(() => {
    initPixels();
    const observer = new ResizeObserver(() => {
      initPixels();
    });
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    return () => {
      observer.disconnect();
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [variantCfg.gap, variantCfg.speed, variantCfg.colors]);

  return (
    <div
      ref={containerRef}
      className={`relative ${className}`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
    >
      <canvas className="absolute inset-0 pointer-events-none" ref={canvasRef} />
      {children}
    </div>
  );
}

// Types
interface APIResponse<T> {
  success: boolean;
  error?: string;
  details?: string[];
  project?: Project;
  projects?: Project[];
  total?: number;
  limit?: number;
  offset?: number;
}

interface Project {
  id: string;
  userId: string;
  name: string;
  fileKey: string;
  rawRoots?: any[];
  frameCount: number;
  thumbnail?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ProjectListResponse {
  success: boolean;
  projects: Project[];
  total: number;
  limit: number;
  offset: number;
}

interface ProjectResponse {
  success: boolean;
  project: Project;
}

interface ApiError {
  success: false;
  error: string;
  details?: string[];
}

interface User {
  name?: string;
  email?: string;
  handle?: string;
  img_url?: string;
}

interface CreateProjectModalProps {
  onClose: () => void;
  onCreate: (name: string, figmaUrl: string, thumbnailFile: File | null) => Promise<void>;
}

export default function ProjectsPage() {
  // State management
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [user, setUser] = useState<User | null>(null);
  
  // Routing
  const router = useRouter();

  // Load projects on mount
  useEffect(() => {
    const initializeData = async () => {
      await loadProjects();
      await fetchUser();
    };
    
    initializeData();
  }, []);

  const meCacheRef = useRef<{ time: number; data: any } | null>(null);
  const meInFlightRef = useRef<Promise<any> | null>(null);
  const fetchUser = async () => {
    try {
      const now = Date.now();
      // Return cached value if within 15 seconds
      if (meCacheRef.current && now - meCacheRef.current.time < 15000) {
        setUser(meCacheRef.current.data);
        return meCacheRef.current.data;
      }
      // Deduplicate concurrent calls
      if (meInFlightRef.current) {
        return await meInFlightRef.current;
      }
      meInFlightRef.current = fetch('/api/figma/me', { credentials: 'include', cache: 'no-store' })
        .then(async (res) => {
          const data = await res.json();
          if (!data.error) {
            meCacheRef.current = { time: Date.now(), data };
            setUser(data);
          }
          return data;
        })
        .finally(() => {
          meInFlightRef.current = null;
        });
      return await meInFlightRef.current;
    } catch (e) {
      console.error('Failed to fetch user:', e);
    }
  };

  const loadProjects = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/projects', {
        method: 'GET',
        headers: { 
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json() as APIResponse<Project>;

      if (!response.ok || !data.success) {
        throw new Error(data.error || `HTTP error ${response.status}`);
      }

      // Safely handle projects array
      const projectsList = Array.isArray(data.projects) ? data.projects : [];
      setProjects(projectsList);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load projects';
      setError(message);
      console.error('Error loading projects:', err);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  const uploadToMintApi = async (file: File): Promise<string | null> => {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload-proxy', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.url) {
        return data.url;
      } else {
        console.error('Upload failed:', data);
        return null;
      }
    } catch (err) {
      console.error('Upload error:', err);
      return null;
    }
  };

  const handleCreateProject = async (name: string, figmaUrl: string, thumbnailFile: File | null) => {
    setError(null);
    let thumbnail: string | null = null;

    try {
      console.log('[CREATE PROJECT] Starting project creation:', { name, figmaUrl });
      
      const hasFigmaUrl = Boolean(figmaUrl && figmaUrl.trim());
      // Extract fileKey from Figma URL if provided
      const fileKey = hasFigmaUrl ? (figmaUrl.split('/').pop()?.split('?')[0] || figmaUrl) : undefined;
      if (hasFigmaUrl) console.log('[CREATE PROJECT] Extracted fileKey:', fileKey);

      if (thumbnailFile) {
        console.log('[CREATE PROJECT] Uploading thumbnail...');
        thumbnail = await uploadToMintApi(thumbnailFile);
        console.log('[CREATE PROJECT] Thumbnail uploaded:', thumbnail);
      }

      let frameCount = 0;
      let rawRoots: any[] = [];
      if (hasFigmaUrl) {
        // First, get the Figma frame data
        console.log('[CREATE PROJECT] Fetching Figma data...');
        const figmaRes = await fetch(`/api/figma/frames?fileUrl=${encodeURIComponent(figmaUrl)}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        });

        if (!figmaRes.ok) {
          const errorText = await figmaRes.text();
          console.error('[CREATE PROJECT] Figma fetch failed:', figmaRes.status, errorText);
          throw new Error(`Failed to fetch Figma data (${figmaRes.status}). Please check the URL and ensure you have access to the file.`);
        }

        const figmaData = await figmaRes.json();
        rawRoots = (figmaData.extracted || figmaData.frames || []);
        frameCount = rawRoots.length;
        console.log('[CREATE PROJECT] Figma data fetched:', { frameCount });
      }
      
      // Create project via API
      console.log('[CREATE PROJECT] Creating project via API...');
      const createRes = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name,
          // Provide a placeholder key if no Figma URL was provided
          ...(hasFigmaUrl && fileKey ? { fileKey } : { fileKey: `manual_${Date.now().toString(36)}` }),
          // Avoid sending huge payloads that trigger 413 upstream
          frameCount,
          // Upstream requires rawRoots to be an array. Use [] when no Figma URL.
          rawRoots,
          thumbnail,
        }),
      });

      const data: APIResponse<Project> = await createRes.json();
      console.log('[CREATE PROJECT] API response:', { status: createRes.status, data });

      if (!createRes.ok) {
        const errorMessage = data.error || (Array.isArray(data.details) ? data.details.join(', ') : 'Failed to create project');
        console.error('[CREATE PROJECT] Creation failed:', errorMessage);
        throw new Error(errorMessage);
      }

      if (data.success && data.project) {
        // Type assertion to ensure project is not undefined
        const newProject = data.project as Project;
        console.log('[CREATE PROJECT] Project created successfully:', newProject.id);
        setProjects(prev => [...prev, newProject]);
        setIsModalOpen(false);
        
        // Store project data for canvas
        sessionStorage.setItem('currentProject', JSON.stringify(newProject));
        (window as any).__currentProject = newProject;
        
        // Route to the project canvas using hash navigation
        console.log('[CREATE PROJECT] Navigating to project:', `#project=${newProject.id}`);
        window.location.hash = `#project=${newProject.id}`;
      } else {
        console.error('[CREATE PROJECT] Unexpected response format:', data);
        setError('Failed to create project - unexpected response format');
      }
    } catch (e: any) {
      console.error('[CREATE PROJECT] Error:', e);
      setError(e?.message || 'Failed to create project');
    }
  };

  const handleDeleteProject = async (id: string) => {
    if (confirm('Are you sure you want to delete this project?')) {
      try {
        const response = await fetch(`/api/projects/${id}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          // Remove project from local state
          setProjects(projects.filter((p) => p.id !== id));
        } else {
          const errorData: ApiError = await response.json();
          setError(errorData.error || 'Failed to delete project');
        }
      } catch (e: any) {
        setError(e?.message || 'Failed to delete project');
      }
    }
  };

  const handleOpenProject = async (id: string) => {
    setError(null);
    try {
      const response = await fetch(`/api/projects/${id}`, {
        method: 'GET',
        headers: { 
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json() as APIResponse<Project>;

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to load project');
      }

      if (data.project) {
        // Store project data for canvas
        sessionStorage.setItem('currentProject', JSON.stringify(data.project));
        (window as any).__currentProject = data.project;
        
        // Route to the canvas view using hash navigation
        window.location.hash = `#project=${id}`;
      } else {
        throw new Error('Project data not found');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load project';
      setError(message);
      console.error('Error loading project:', err);
    }
  };

  const handleEditProject = (projectId: string) => {
    const projectToEdit = projects.find(p => p.id === projectId);
    if (projectToEdit) {
      setCurrentProject(projectToEdit);
      setIsEditModalOpen(true);
    }
  };

  const handleUpdateProject = async (id: string, name: string, figmaUrl: string, thumbnailFile: File | null) => {
    setError(null);
    let thumbnail: string | null = null;

    try {
      if (thumbnailFile) {
        thumbnail = await uploadToMintApi(thumbnailFile);
      }

      const projectToUpdate = projects.find(p => p.id === id);
      
      if (!projectToUpdate) {
        throw new Error("Project not found");
      }

      // Extract fileKey from Figma URL
      const fileKey = figmaUrl ? (figmaUrl.split('/').pop()?.split('?')[0] || figmaUrl) : projectToUpdate.fileKey;

      let updateData: any = { name };
      if (thumbnail) updateData.thumbnail = thumbnail;

      // If Figma URL changed, fetch new frame data
      if (figmaUrl && figmaUrl !== projectToUpdate.fileKey) {
        const figmaRes = await fetch(`/api/figma/frames?fileUrl=${encodeURIComponent(figmaUrl)}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!figmaRes.ok) {
          throw new Error("Failed to fetch Figma data. Please check the URL.");
        }

        const figmaData = await figmaRes.json();
        updateData.fileKey = fileKey;
        updateData.rawRoots = figmaData.extracted || figmaData.frames || [];
        updateData.frameCount = (figmaData.extracted || figmaData.frames || []).length;
      }

      const res = await fetch(`/api/projects/${id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData),
      });

      const data = await res.json() as APIResponse<Project>;

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to update project");
      }

      if (data.project) {
        // Update local state
        setProjects(prevProjects => 
          prevProjects.map(p => p.id === id ? data.project as Project : p)
        );
        
        setIsEditModalOpen(false);
        setCurrentProject(null);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update project";
      setError(message);
      console.error('Update error:', err);
    }
  };

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-black"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b-4 border-black backdrop-blur-sm bg-opacity-95 shadow-[8px_8px_0_0_#000]">
        <nav className="flex w-full items-center justify-between py-3 px-6 md:px-8 max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <span className="h-9 w-9 rounded-sm bg-amber-400 ring-2 ring-black flex items-center justify-center shadow-[4px_4px_0_0_#000]">
              <span className="h-4 w-4 rounded-[2px] bg-black block" />
            </span>
            <span className="text-base md:text-lg font-extrabold tracking-tight text-black">FigmaFlow</span>
          </div>
          {user && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-black hidden md:block">{user.email || user.name}</span>
              <div className="h-9 w-9 rounded-full bg-red-600 text-white ring-2 ring-black flex items-center justify-center shadow-[3px_3px_0_0_#000]">
                <span className="text-xs font-extrabold">
                  {(user.name || user.email || 'U').charAt(0).toUpperCase()}
                </span>
              </div>
              <button
                onClick={() => (window.location.href = "/api/auth/logout")}
                className="px-3 py-1.5 text-xs font-extrabold text-black bg-amber-400 border-2 border-black rounded-md hover:bg-amber-500 transition-colors shadow-[3px_3px_0_0_#000] hover:shadow-[4px_4px_0_0_#000]"
              >
                Logout
              </button>
            </div>
          )}
        </nav>
      </header>

      <main className="max-w-7xl mx-auto px-6 md:px-8 py-8 md:py-12">
        {/* Error Banner */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border-4 border-black rounded-md text-red-800 text-sm shadow-[6px_6px_0_0_#000]">
            {error}
            <button onClick={() => setError(null)} className="float-right text-red-700 font-extrabold">
              ✕
            </button>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-black">My Projects</h1>
            <p className="text-black mt-2">Manage and organize your Figma conversions</p>
          </div>
        </div>

        {/* Search Bar */}
        {projects.length > 0 && (
          <div className="mb-8 max-w-md">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="11" cy="11" r="8" strokeWidth="2.5" />
                <path d="M21 21l-4.35-4.35" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search projects..."
                className="w-full pl-10 pr-4 py-3 border-2 border-black rounded-md focus:outline-none focus:ring-2 focus:ring-red-600 shadow-[4px_4px_0_0_#000] font-semibold"
              />
            </div>
          </div>
        )}

        {/* Projects Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {/* Create New Project Card */}
          <PixelCard
            variant="red"
            className="group bg-white rounded-lg border-4 border-black overflow-hidden shadow-[6px_6px_0_0_#000] hover:shadow-[8px_8px_0_0_#000] transition-all cursor-pointer"
            onClick={() => setIsModalOpen(true)}
          >
            <div className="aspect-[3/4] bg-gradient-to-br from-red-50 to-amber-50 flex items-center justify-center border-b-4 border-black">
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-red-600 border-2 border-black flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform shadow-[4px_4px_0_0_#000]">
                  <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <p className="font-extrabold text-sm text-black">Create New Project</p>
                <p className="text-xs text-black mt-1">Import a Figma file</p>
              </div>
            </div>
            <div className="p-3">
              <p className="text-xs text-black text-center">Get started with your design</p>
            </div>
          </PixelCard>

          {/* Existing Projects */}
          {filteredProjects.map((project) => (
              <PixelCard
                key={project.id}
                variant="blue"
                className="group bg-white rounded-lg border-4 border-black overflow-hidden shadow-[6px_6px_0_0_#000] hover:shadow-[8px_8px_0_0_#000] transition-all cursor-pointer"
                onClick={() => handleOpenProject(project.id)}
              >
                <div className="aspect-[3/4] bg-gradient-to-br from-blue-50 to-purple-50 border-b-4 border-black overflow-hidden relative">
                  {project.thumbnail ? (
                    <img
                      src={project.thumbnail}
                      alt={project.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = './Fallback.png';
                      }}
                      loading="lazy"
                    />
                  ) : (
                    <img
                      src="/Fallback.png"
                      alt="No thumbnail"
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                <div className="p-3">
                  <h3 className="font-extrabold text-base truncate text-black">{project.name}</h3>
                  <p className="text-sm text-black mt-1">{project.frameCount} frames</p>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-xs text-black">
                      {new Date(project.updatedAt).toLocaleDateString()}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteProject(project.id);
                      }}
                      className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50 transition-colors"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </PixelCard>
            ))}
          </div>

        {filteredProjects.length === 0 && projects.length > 0 && (
          <div className="text-center py-12">
            <p className="text-black">No projects found matching "{searchQuery}"</p>
          </div>
        )}
      </main>

      {/* Create Project Modal */}
      {isModalOpen && <CreateProjectModal onClose={() => setIsModalOpen(false)} onCreate={handleCreateProject} />}
    </div>
  );
}

function CreateProjectModal({ onClose, onCreate }: CreateProjectModalProps) {
  const [projectName, setProjectName] = useState('');
  const [figmaUrl, setFigmaUrl] = useState('');
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [authError, setAuthError] = useState('');
  const [isCheckingAuth, setIsCheckingAuth] = useState(false);

  const handleCreate = async () => {
    if (!projectName.trim()) return;

    // Only verify Figma auth if a URL was provided
    if (figmaUrl.trim()) {
      setIsCheckingAuth(true);
      try {
        const res = await fetch('/api/figma/me', { credentials: 'include' });
        if (!res.ok) {
          setAuthError('Your Figma session is missing or expired. Click "Login with Figma" in the navigation bar.');
          setIsCheckingAuth(false);
          return;
        }
      } catch (err) {
        setAuthError('Unable to verify Figma session. Please try again.');
        setIsCheckingAuth(false);
        return;
      }
      setIsCheckingAuth(false);
      setAuthError('');
    } else {
      // Clear any previous auth errors when no URL is provided
      setAuthError('');
    }

    setIsCreating(true);
    await onCreate(projectName, figmaUrl, thumbnailFile);
    setIsCreating(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-lg border-4 border-black shadow-[10px_10px_0_0_#000] max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b-4 border-black bg-amber-400">
          <h2 className="text-xl font-extrabold text-black">Create New Project</h2>
          <p className="text-sm text-black mt-1">Import a Figma file to get started</p>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-extrabold mb-2 text-black">Project Name</label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="My Awesome Project"
              className="w-full px-4 py-2.5 border-2 border-black rounded-md focus:outline-none focus:ring-2 focus:ring-red-600 shadow-[4px_4px_0_0_#000] text-black"
            />
          </div>

          <div>
            <label className="block text-sm font-extrabold mb-2 text-black">Figma File URL (optional)</label>
            <input
              type="text"
              value={figmaUrl}
              onChange={(e) => setFigmaUrl(e.target.value)}
              placeholder="https://figma.com/file/..."
              className="w-full px-4 py-2.5 border-2 border-black rounded-md focus:outline-none focus:ring-2 focus:ring-red-600 shadow-[4px_4px_0_0_#000] text-black"
            />
          </div>

          <div>
            <label className="block text-sm font-extrabold mb-2 text-black">Thumbnail (Optional)</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setThumbnailFile(e.target.files ? e.target.files[0] : null)}
              className="w-full px-4 py-2.5 border-2 border-black rounded-md focus:outline-none focus:ring-2 focus:ring-red-600 shadow-[4px_4px_0_0_#000] text-black"
            />
          </div>

          {/* Authentication Error */}
          {authError && (
            <div className="p-4 bg-red-100 border-2 border-red-600 rounded-md">
              <p className="text-sm font-bold text-red-900">{authError}</p>
            </div>
          )}
        </div>

        <div className="p-6 bg-stone-100 bord er-t-2 border-black flex gap-3 justify-end">
          <button
            onClick={onClose}
            disabled={isCreating}
            className="px-5 py-2.5 rounded-md border-2 border-black text-sm font-extrabold bg-white hover:-translate-y-0.5 transition shadow-[4px_4px_0_0_#000] text-black"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!projectName.trim() || isCreating || isCheckingAuth}
            className="px-5 py-2.5 rounded-md bg-red-600 text-white border-2 border-black text-sm font-extrabold hover:bg-red-700 transition disabled:opacity-50 shadow-[4px_4px_0_0_#000]"
          >
            {isCheckingAuth ? 'Verifying session...' : isCreating ? 'Creating...' : 'Create Project'}
          </button>
        </div>
      </div>
    </div>
  );
}