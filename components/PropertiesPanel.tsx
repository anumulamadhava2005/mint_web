/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { NodeInput } from "../lib/figma-types";

export default function PropertiesPanel(props: {
  selectedNode: NodeInput | null;
  onUpdateSelected: (mut: (n: NodeInput) => void) => void;
}) {
  const { selectedNode, onUpdateSelected } = props;
  if (!selectedNode) return null;

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

      {/* Fill */}
      <div className="space-y-2 mb-4">
        <div className="text-xs text-gray-600">Fill</div>
        <input
          type="color"
          className="w-full h-8 border rounded"
          value={(selectedNode.fill?.type === "SOLID" && selectedNode.fill.color) || "#ffffff"}
          onChange={(e) =>
            onUpdateSelected((n) => {
              n.fill = { type: "SOLID", color: e.target.value };
            })
          }
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
