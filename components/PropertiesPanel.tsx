/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useRef, useState } from "react";
import { NodeInput } from "../lib/figma-types";

export default function PropertiesPanel(props: {
  selectedNode: NodeInput | null;
  onUpdateSelected: (mut: (n: NodeInput) => void) => void;
  images?: Record<string, string>; // optional: map nodeId/name -> URL (for preview sync)
  onImageChange?: (id: string, url: string) => void; // optional callback to sync external caches
}) {
  const { selectedNode, onUpdateSelected, images, onImageChange } = props;
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [localImg, setLocalImg] = useState<string | null>(null);

  if (!selectedNode) return null;

  const nodeKey = selectedNode.id || selectedNode.name;
  const currentImage =
    localImg ??
    (typeof selectedNode.fill?.imageRef === "string" ? selectedNode.fill?.imageRef : null) ??
    ((images ? images[nodeKey] || null : null) || null);

  function setImageUrl(url: string) {
    setLocalImg(url);
    onUpdateSelected((n) => {
      const prev = n.fill && n.fill.type === "IMAGE" ? n.fill : null;
      n.fill = { type: "IMAGE", imageRef: url, ...(prev || {}) } as any;
    });
    if (onImageChange) onImageChange(nodeKey, url);
  }

  function clearImage() {
    setLocalImg(null);
    onUpdateSelected((n) => {
      // Remove image fill; keep other fill types if desired. Here we null it.
      if (n.fill?.type === "IMAGE") n.fill = null;
    });
    if (onImageChange) onImageChange(nodeKey, "");
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Convert to a local preview URL (data URL) for immediate rendering
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result || "");
      if (url) setImageUrl(url);
    };
    reader.readAsDataURL(file);
  }

  const hasImageFill = selectedNode.fill?.type === "IMAGE" || Boolean(currentImage);
  const fillColor = selectedNode.fill?.type === "SOLID" ? selectedNode.fill.color : "#ffffff";

  function ImageUrlField(props: {
    initialUrl: string;
    onPreview: (url: string) => void;
    onApply: (url: string) => void;
    onClear: () => void;
  }) {
    const { initialUrl, onPreview, onApply, onClear } = props;
    const [url, setUrl] = useState(initialUrl);
    const [isValid, setIsValid] = useState(true);

    // Validate as URL; allow empty string
    function validate(value: string) {
      if (!value) return true;
      try {
        // Accept http(s) or data:image/...;base64
        if (value.startsWith("data:image/")) return true;
        const u = new URL(value);
        return u.protocol === "http:" || u.protocol === "https:";
      } catch {
        return false;
      }
    }

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      const v = e.target.value;
      setUrl(v);
      setIsValid(validate(v));
      onPreview(v); // live preview as the user types
    }

    function handleApply() {
      if (!validate(url)) return;
      onApply(url);
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
      if (e.key === "Enter") {
        e.preventDefault();
        handleApply();
      }
    }

    return (
      <div className="space-y-2">
        <div className="flex gap-2">
          <input
            type="url"
            placeholder="https://example.com/image.png"
            className={`bg-gray-800 border rounded px-2 py-1 text-xs w-full text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ${
              isValid ? "border-gray-700" : "border-red-500"
            }`}
            value={url}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            title="Enter a valid http(s) URL or a data:image URL"
          />
          <button
            type="button"
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded px-2 py-1 text-xs font-medium"
            disabled={!isValid}
            onClick={handleApply}
            title={isValid ? "Set image" : "URL invalid"}
          >
            Set
          </button>
          <button
            type="button"
            className="bg-gray-700 hover:bg-gray-600 text-gray-200 rounded px-2 py-1 text-xs"
            onClick={() => {
              setUrl("");
              setIsValid(true);
              onPreview("");
              onClear();
            }}
          >
            Clear
          </button>
        </div>

        {/* Inline URL preview box */}
        {url ? (
          <div className="w-full h-20 border border-gray-700 rounded overflow-hidden bg-gray-800 flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt="URL preview"
              className="max-w-full max-h-full object-contain"
              onError={() => setIsValid(false)}
              onLoad={() => setIsValid(true)}
            />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <aside className="w-72 border-l border-gray-800 bg-gray-950 p-4 overflow-y-auto text-gray-200">
      {/* Header */}
      <div className="mb-4 pb-3 border-b border-gray-800">
        <div className="text-sm font-semibold text-white mb-1">Properties</div>
        <div className="text-xs text-gray-500">{selectedNode.name || selectedNode.id}</div>
      </div>

      {/* Size */}
      <div className="space-y-2 mb-4">
        <div className="text-xs font-medium text-gray-400 mb-1">Size</div>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            value={selectedNode.width ?? selectedNode.absoluteBoundingBox?.width ?? 0}
            onChange={(e) => {
              const w = Number(e.target.value) || 0;
              onUpdateSelected((n) => {
                if (n.absoluteBoundingBox) n.absoluteBoundingBox.width = w;
                else (n as any).width = w;
              });
            }}
          />
          <input
            type="number"
            className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            value={selectedNode.height ?? selectedNode.absoluteBoundingBox?.height ?? 0}
            onChange={(e) => {
              const h = Number(e.target.value) || 0;
              onUpdateSelected((n) => {
                if (n.absoluteBoundingBox) n.absoluteBoundingBox.height = h;
                else (n as any).height = h;
              });
            }}
          />
        </div>
      </div>

      {/* Image */}
      <div className="space-y-2 mb-4">
        <div className="text-xs font-medium text-gray-400 mb-1">Image</div>

        {/* URL input with preview */}
        <ImageUrlField
          initialUrl={currentImage || ""}
          onPreview={(u) => setLocalImg(u || null)}
          onApply={(u) => {
            if (u && u.trim()) setImageUrl(u.trim());
          }}
          onClear={() => clearImage()}
        />

        {/* File upload */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="bg-gray-700 hover:bg-gray-600 text-gray-200 rounded px-3 py-1.5 text-xs font-medium"
            onClick={() => fileRef.current?.click()}
          >
            Upload File
          </button>
          <span className="text-xs text-gray-500">PNG/JPG</span>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFile}
        />

        {/* Final preview */}
        {currentImage && (
          <div className="w-full h-24 border border-gray-700 rounded overflow-hidden bg-gray-800 flex items-center justify-center mt-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={currentImage} alt="Preview" className="max-w-full max-h-full object-contain" />
          </div>
        )}
      </div>

      {/* Fill */}
      <div className="space-y-2 mb-4">
        <div className="text-xs font-medium text-gray-400 mb-1">Fill</div>
        <input
          type="color"
          className="w-full h-8 bg-gray-800 border border-gray-700 rounded cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          value={fillColor || "#ffffff"}
          disabled={hasImageFill}
          onChange={(e) =>
            onUpdateSelected((n) => {
              n.fill = { type: "SOLID", color: e.target.value };
            })
          }
          title={hasImageFill ? "Remove image to edit solid fill" : "Pick color"}
        />
      </div>

      {/* Stroke */}
      <div className="space-y-2 mb-4">
        <div className="text-xs font-medium text-gray-400 mb-1">Stroke</div>
        <div className="grid grid-cols-3 gap-2">
          <input
            type="color"
            className="bg-gray-800 border border-gray-700 rounded cursor-pointer"
            value={selectedNode.stroke?.color || "#000000"}
            onChange={(e) =>
              onUpdateSelected((n) => {
                n.stroke = { ...(n.stroke || {}), color: e.target.value };
              })
            }
          />
          <input
            type="number"
            min={0}
            className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            value={selectedNode.stroke?.weight ?? 1}
            onChange={(e) =>
              onUpdateSelected((n) => {
                n.stroke = { ...(n.stroke || {}), weight: Number(e.target.value) || 0 };
              })
            }
          />
          <select
            className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            value={selectedNode.stroke?.align || "CENTER"}
            onChange={(e) =>
              onUpdateSelected((n) => {
                n.stroke = { ...(n.stroke || {}), align: e.target.value };
              })
            }
          >
            <option value="INSIDE">Inside</option>
            <option value="CENTER">Center</option>
            <option value="OUTSIDE">Outside</option>
          </select>
        </div>
      </div>

      {/* Corners */}
      <div className="space-y-2 mb-4">
        <div className="text-xs font-medium text-gray-400 mb-1">Corner radius</div>
        <input
          type="number"
          min={0}
          className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 w-full focus:outline-none focus:ring-1 focus:ring-blue-500"
          value={selectedNode.corners?.uniform ?? 0}
          onChange={(e) =>
            onUpdateSelected((n) => {
              const r = Math.max(0, Number(e.target.value) || 0);
              n.corners = { ...(n.corners || {}), uniform: r };
            })
          }
        />
      </div>

      {/* Text */}
      {selectedNode.text && (
        <div className="space-y-2 mb-4">
          <div className="text-xs font-medium text-gray-400 mb-1">Text</div>
          <textarea
            className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 w-full focus:outline-none focus:ring-1 focus:ring-blue-500"
            rows={3}
            value={selectedNode.text.characters || ""}
            onChange={(e) =>
              onUpdateSelected((n) => {
                n.text = { ...(n.text || {}), characters: e.target.value };
              })
            }
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              min={1}
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={selectedNode.text.fontSize ?? 12}
              onChange={(e) =>
                onUpdateSelected((n) => {
                  n.text = { ...(n.text || {}), fontSize: Number(e.target.value) || 12 };
                })
              }
            />
            <input
              type="text"
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Font family"
              value={selectedNode.text.fontFamily || "system-ui"}
              onChange={(e) =>
                onUpdateSelected((n) => {
                  n.text = { ...(n.text || {}), fontFamily: e.target.value };
                })
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="color"
              className="bg-gray-800 border border-gray-700 rounded cursor-pointer"
              value={selectedNode.text.color || "#333333"}
              onChange={(e) =>
                onUpdateSelected((n) => {
                  n.text = { ...(n.text || {}), color: e.target.value };
                })
              }
            />
            <input
              type="number"
              min={0}
              step={0.1}
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Line height"
              value={selectedNode.text.lineHeight ?? ""}
              onChange={(e) =>
                onUpdateSelected((n) => {
                  const v = e.target.value === "" ? null : Number(e.target.value);
                  n.text = { ...(n.text || {}), lineHeight: (v as any) };
                })
              }
            />
          </div>
        </div>
      )}

      {/* Shadow */}
      <div className="space-y-2 mb-2">
        <div className="text-xs font-medium text-gray-400 mb-1">Shadow</div>
        <input
          type="text"
          className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 w-full focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="e.g. 0px 4px 10px rgba(0,0,0,0.15)"
          value={selectedNode.effects?.find((e) => e?.boxShadow)?.boxShadow || ""}
          onChange={(e) =>
            onUpdateSelected((n) => {
              const effects = [...(n.effects || [])];
              const idx = effects.findIndex((x) => x?.boxShadow);
              const entry = { type: "DROP_SHADOW", boxShadow: e.target.value };
              if (idx >= 0) effects[idx] = entry as any;
              else effects.push(entry as any);
              n.effects = effects as any;
            })
          }
        />
      </div>
    </aside>
  );
}