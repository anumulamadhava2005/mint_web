/**
 * KeyboardManager - Handles all keyboard shortcuts with Figma-like behavior
 * 
 * Features:
 * - Arrow key nudging (1px or 10px with Shift)
 * - Delete/Backspace to delete
 * - Cmd+D to duplicate
 * - Cmd+G to group
 * - Cmd+Shift+G to ungroup
 * - Cmd+[ / Cmd+] to reorder z-index
 * - Cmd+Z / Cmd+Shift+Z for undo/redo
 * - Escape to deselect
 * - Space+drag for pan
 * - Cmd+0/1/2 for zoom presets
 */

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type ShortcutHandler = () => void;

export interface ShortcutConfig {
  /** Key code or key */
  key: string;
  /** Require Cmd/Ctrl */
  cmd?: boolean;
  /** Require Shift */
  shift?: boolean;
  /** Require Alt/Option */
  alt?: boolean;
  /** Handler function */
  handler: ShortcutHandler;
  /** Human-readable description */
  description: string;
  /** Prevent default browser behavior */
  preventDefault?: boolean;
}

export interface KeyState {
  /** Space bar held (for panning) */
  space: boolean;
  /** Shift held */
  shift: boolean;
  /** Cmd/Ctrl held */
  cmd: boolean;
  /** Alt/Option held */
  alt: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

/** Nudge amount in pixels */
export const NUDGE_SMALL = 1;

/** Large nudge amount (with Shift) */
export const NUDGE_LARGE = 10;

// ═══════════════════════════════════════════════════════════════════════════════
// KEYBOARD MANAGER
// ═══════════════════════════════════════════════════════════════════════════════

export class KeyboardManager {
  private shortcuts: Map<string, ShortcutConfig> = new Map();
  private keyState: KeyState = {
    space: false,
    shift: false,
    cmd: false,
    alt: false,
  };
  private enabled: boolean = true;
  private target: EventTarget | null = null;
  
  // ─── Setup ───
  
  /**
   * Attach to an element (typically window or canvas container)
   */
  attach(target: EventTarget): void {
    this.target = target;
    target.addEventListener('keydown', this.handleKeyDown as EventListener);
    target.addEventListener('keyup', this.handleKeyUp as EventListener);
    
    // Handle blur to reset key state
    if (typeof window !== 'undefined') {
      window.addEventListener('blur', this.handleBlur);
    }
  }
  
  /**
   * Detach from element
   */
  detach(): void {
    if (this.target) {
      this.target.removeEventListener('keydown', this.handleKeyDown as EventListener);
      this.target.removeEventListener('keyup', this.handleKeyUp as EventListener);
    }
    
    if (typeof window !== 'undefined') {
      window.removeEventListener('blur', this.handleBlur);
    }
    
    this.target = null;
  }
  
  /**
   * Enable/disable shortcuts
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.resetKeyState();
    }
  }
  
  // ─── State Access ───
  
  /**
   * Get current key state
   */
  getKeyState(): Readonly<KeyState> {
    return this.keyState;
  }
  
  /**
   * Check if space is held (for pan mode)
   */
  isSpaceHeld(): boolean {
    return this.keyState.space;
  }
  
  /**
   * Check if Shift is held
   */
  isShiftHeld(): boolean {
    return this.keyState.shift;
  }
  
  /**
   * Check if Cmd/Ctrl is held
   */
  isCmdHeld(): boolean {
    return this.keyState.cmd;
  }
  
  /**
   * Check if Alt is held
   */
  isAltHeld(): boolean {
    return this.keyState.alt;
  }
  
  // ─── Shortcut Registration ───
  
  /**
   * Register a keyboard shortcut
   */
  registerShortcut(config: ShortcutConfig): void {
    const key = this.makeKey(config);
    this.shortcuts.set(key, config);
  }
  
  /**
   * Unregister a shortcut
   */
  unregisterShortcut(key: string, cmd?: boolean, shift?: boolean, alt?: boolean): void {
    const mapKey = this.makeKey({ key, cmd, shift, alt });
    this.shortcuts.delete(mapKey);
  }
  
  /**
   * Get all registered shortcuts
   */
  getShortcuts(): ShortcutConfig[] {
    return Array.from(this.shortcuts.values());
  }
  
  // ─── Event Handlers ───
  
  private handleKeyDown = (e: KeyboardEvent): void => {
    // Update key state
    this.updateKeyState(e, true);
    
    if (!this.enabled) return;
    
    // Check if input is focused
    if (this.isInputFocused()) return;
    
    // Find matching shortcut
    const key = this.makeKeyFromEvent(e);
    const config = this.shortcuts.get(key);
    
    if (config) {
      if (config.preventDefault !== false) {
        e.preventDefault();
      }
      config.handler();
    }
  };
  
  private handleKeyUp = (e: KeyboardEvent): void => {
    this.updateKeyState(e, false);
  };
  
  private handleBlur = (): void => {
    this.resetKeyState();
  };
  
  // ─── Helpers ───
  
  private updateKeyState(e: KeyboardEvent, pressed: boolean): void {
    if (e.key === ' ') {
      this.keyState.space = pressed;
    }
    if (e.key === 'Shift') {
      this.keyState.shift = pressed;
    }
    if (e.key === 'Meta' || e.key === 'Control') {
      this.keyState.cmd = pressed;
    }
    if (e.key === 'Alt') {
      this.keyState.alt = pressed;
    }
    
    // Also update from event flags
    if (pressed) {
      this.keyState.shift = e.shiftKey;
      this.keyState.cmd = e.metaKey || e.ctrlKey;
      this.keyState.alt = e.altKey;
    }
  }
  
  private resetKeyState(): void {
    this.keyState = {
      space: false,
      shift: false,
      cmd: false,
      alt: false,
    };
  }
  
  private makeKey(config: Pick<ShortcutConfig, 'key' | 'cmd' | 'shift' | 'alt'>): string {
    const parts: string[] = [];
    if (config.cmd) parts.push('cmd');
    if (config.shift) parts.push('shift');
    if (config.alt) parts.push('alt');
    parts.push(config.key.toLowerCase());
    return parts.join('+');
  }
  
  private makeKeyFromEvent(e: KeyboardEvent): string {
    const parts: string[] = [];
    if (e.metaKey || e.ctrlKey) parts.push('cmd');
    if (e.shiftKey) parts.push('shift');
    if (e.altKey) parts.push('alt');
    parts.push(e.key.toLowerCase());
    return parts.join('+');
  }
  
  private isInputFocused(): boolean {
    if (typeof document === 'undefined') return false;
    const active = document.activeElement;
    if (!active) return false;
    const tagName = active.tagName.toLowerCase();
    return tagName === 'input' || tagName === 'textarea' || (active as HTMLElement).isContentEditable;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULT SHORTCUTS FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

export interface ShortcutCallbacks {
  onUndo: () => void;
  onRedo: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onGroup: () => void;
  onUngroup: () => void;
  onSelectAll: () => void;
  onDeselect: () => void;
  onNudge: (dx: number, dy: number) => void;
  onBringForward: () => void;
  onSendBackward: () => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoom100: () => void;
  onFitToScreen: () => void;
  onCopy: () => void;
  onCut: () => void;
  onPaste: () => void;
}

/**
 * Register all default Figma-like shortcuts
 */
export function registerDefaultShortcuts(
  manager: KeyboardManager,
  callbacks: ShortcutCallbacks
): void {
  // Undo/Redo
  manager.registerShortcut({
    key: 'z',
    cmd: true,
    handler: callbacks.onUndo,
    description: 'Undo',
  });
  
  manager.registerShortcut({
    key: 'z',
    cmd: true,
    shift: true,
    handler: callbacks.onRedo,
    description: 'Redo',
  });
  
  // Delete
  manager.registerShortcut({
    key: 'Backspace',
    handler: callbacks.onDelete,
    description: 'Delete',
  });
  
  manager.registerShortcut({
    key: 'Delete',
    handler: callbacks.onDelete,
    description: 'Delete',
  });
  
  // Duplicate
  manager.registerShortcut({
    key: 'd',
    cmd: true,
    handler: callbacks.onDuplicate,
    description: 'Duplicate',
  });
  
  // Group/Ungroup
  manager.registerShortcut({
    key: 'g',
    cmd: true,
    handler: callbacks.onGroup,
    description: 'Group',
  });
  
  manager.registerShortcut({
    key: 'g',
    cmd: true,
    shift: true,
    handler: callbacks.onUngroup,
    description: 'Ungroup',
  });
  
  // Selection
  manager.registerShortcut({
    key: 'a',
    cmd: true,
    handler: callbacks.onSelectAll,
    description: 'Select All',
  });
  
  manager.registerShortcut({
    key: 'Escape',
    handler: callbacks.onDeselect,
    description: 'Deselect',
  });
  
  // Nudge
  manager.registerShortcut({
    key: 'ArrowUp',
    handler: () => callbacks.onNudge(0, -NUDGE_SMALL),
    description: 'Nudge Up',
    preventDefault: true,
  });
  
  manager.registerShortcut({
    key: 'ArrowDown',
    handler: () => callbacks.onNudge(0, NUDGE_SMALL),
    description: 'Nudge Down',
    preventDefault: true,
  });
  
  manager.registerShortcut({
    key: 'ArrowLeft',
    handler: () => callbacks.onNudge(-NUDGE_SMALL, 0),
    description: 'Nudge Left',
    preventDefault: true,
  });
  
  manager.registerShortcut({
    key: 'ArrowRight',
    handler: () => callbacks.onNudge(NUDGE_SMALL, 0),
    description: 'Nudge Right',
    preventDefault: true,
  });
  
  // Large nudge (with Shift)
  manager.registerShortcut({
    key: 'ArrowUp',
    shift: true,
    handler: () => callbacks.onNudge(0, -NUDGE_LARGE),
    description: 'Nudge Up 10px',
    preventDefault: true,
  });
  
  manager.registerShortcut({
    key: 'ArrowDown',
    shift: true,
    handler: () => callbacks.onNudge(0, NUDGE_LARGE),
    description: 'Nudge Down 10px',
    preventDefault: true,
  });
  
  manager.registerShortcut({
    key: 'ArrowLeft',
    shift: true,
    handler: () => callbacks.onNudge(-NUDGE_LARGE, 0),
    description: 'Nudge Left 10px',
    preventDefault: true,
  });
  
  manager.registerShortcut({
    key: 'ArrowRight',
    shift: true,
    handler: () => callbacks.onNudge(NUDGE_LARGE, 0),
    description: 'Nudge Right 10px',
    preventDefault: true,
  });
  
  // Z-index
  manager.registerShortcut({
    key: ']',
    cmd: true,
    handler: callbacks.onBringForward,
    description: 'Bring Forward',
  });
  
  manager.registerShortcut({
    key: '[',
    cmd: true,
    handler: callbacks.onSendBackward,
    description: 'Send Backward',
  });
  
  manager.registerShortcut({
    key: ']',
    cmd: true,
    shift: true,
    handler: callbacks.onBringToFront,
    description: 'Bring to Front',
  });
  
  manager.registerShortcut({
    key: '[',
    cmd: true,
    shift: true,
    handler: callbacks.onSendToBack,
    description: 'Send to Back',
  });
  
  // Zoom
  manager.registerShortcut({
    key: '+',
    cmd: true,
    handler: callbacks.onZoomIn,
    description: 'Zoom In',
  });
  
  manager.registerShortcut({
    key: '=',
    cmd: true,
    handler: callbacks.onZoomIn,
    description: 'Zoom In',
  });
  
  manager.registerShortcut({
    key: '-',
    cmd: true,
    handler: callbacks.onZoomOut,
    description: 'Zoom Out',
  });
  
  manager.registerShortcut({
    key: '0',
    cmd: true,
    handler: callbacks.onZoom100,
    description: 'Zoom to 100%',
  });
  
  manager.registerShortcut({
    key: '1',
    cmd: true,
    handler: callbacks.onFitToScreen,
    description: 'Fit to Screen',
  });
  
  // Copy/Cut/Paste
  manager.registerShortcut({
    key: 'c',
    cmd: true,
    handler: callbacks.onCopy,
    description: 'Copy',
  });
  
  manager.registerShortcut({
    key: 'x',
    cmd: true,
    handler: callbacks.onCut,
    description: 'Cut',
  });
  
  manager.registerShortcut({
    key: 'v',
    cmd: true,
    handler: callbacks.onPaste,
    description: 'Paste',
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

export const keyboardManager = new KeyboardManager();
