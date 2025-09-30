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
    reader.readAsDataURL(file); // preview inline as base64 [5]
    // If uploading to a server/CDN is needed, do it here and set the returned URL instead. [6]
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
            placeholder="https://example.com/image.png or data:image/png;base64,..."
            className={`border rounded px-2 py-1 text-sm w-full ${isValid ? "" : "border-red-500"}`}
            value={url}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            // Optional pattern to guide users; browser validation is supplemental
            pattern="https?://.+"
            title="Enter a valid http(s) URL or a data:image URL"
          />
          <button
            type="button"
            className="border rounded px-2 py-1 text-sm"
            disabled={!isValid}
            onClick={handleApply}
            title={isValid ? "Set image" : "URL invalid"}
          >
            Set
          </button>
          <button
            type="button"
            className="border rounded px-2 py-1 text-sm"
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
          <div className="w-full h-24 border rounded overflow-hidden bg-gray-50 flex items-center justify-center">
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
    <aside className="w-80 border-l bg-white p-3 overflow-y-auto text-black">
      <div className="text-sm font-semibold mb-2">Properties</div>
      <div className="text-xs text-gray-500 mb-3">{selectedNode.name || selectedNode.id}</div>

      {/* Size */}
      <div className="space-y-2 mb-4">
        <div className="text-xs text-gray-600">Size</div>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            className="border rounded px-2 py-1 text-sm"
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
            className="border rounded px-2 py-1 text-sm"
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
      {/* Image */}
      <div className="space-y-2 mb-4">
        <div className="text-xs text-gray-600">Image</div>

        {/* URL input with preview (accepts http(s) or data:image/...;base64) */}
        <ImageUrlField
          initialUrl={currentImage || ""}
          onPreview={(u) => setLocalImg(u || null)} // live preview only
          onApply={(u) => { if (u && u.trim()) setImageUrl(u.trim()); }}
          onClear={() => clearImage()}
        />

        {/* File upload */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="border rounded px-2 py-1 text-sm"
            onClick={() => fileRef.current?.click()}
          >
            Upload…
          </button>
          <span className="text-xs text-gray-500">PNG/JPG recommended</span>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFile}
        />

        {/* Final preview of current image */}
        {currentImage ? (
          <div className="w-full h-28 border rounded overflow-hidden bg-gray-50 flex items-center justify-center mt-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={currentImage} alt="Preview" className="max-w-full max-h-full object-contain" />
          </div>
        ) : null}
      </div>


      {/* Fill (disabled when image is present) */}
      <div className="space-y-2 mb-4 opacity-100">
        <div className="text-xs text-gray-600">Fill</div>
        <input
          type="color"
          className="w-full h-8 border rounded"
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
        <div className="text-xs text-gray-600">Stroke</div>
        <div className="grid grid-cols-3 gap-2">
          <input
            type="color"
            className="border rounded"
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
            className="border rounded px-2 py-1 text-sm"
            value={selectedNode.stroke?.weight ?? 1}
            onChange={(e) =>
              onUpdateSelected((n) => {
                n.stroke = { ...(n.stroke || {}), weight: Number(e.target.value) || 0 };
              })
            }
          />
          <select
            className="border rounded px-2 py-1 text-sm"
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
        <div className="text-xs text-gray-600">Corner radius</div>
        <input
          type="number"
          min={0}
          className="border rounded px-2 py-1 text-sm w-full"
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
          <div className="text-xs text-gray-600">Text</div>
          <textarea
            className="border rounded px-2 py-1 text-sm w-full"
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
              className="border rounded px-2 py-1 text-sm"
              value={selectedNode.text.fontSize ?? 12}
              onChange={(e) =>
                onUpdateSelected((n) => {
                  n.text = { ...(n.text || {}), fontSize: Number(e.target.value) || 12 };
                })
              }
            />
            <input
              type="text"
              className="border rounded px-2 py-1 text-sm"
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
              className="border rounded"
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
              className="border rounded px-2 py-1 text-sm"
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
        <div className="text-xs text-gray-600">Shadow</div>
        <input
          type="text"
          className="border rounded px-2 py-1 text-xs w-full"
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
