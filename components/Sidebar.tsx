
import { NodeInput } from "../lib/figma-types";
import LayersPanel from "./LayersPanel";
import SectionDropdown from "./SectionDropdown";
import { useState } from "react";
import React from "react";


export default function Sidebar(props: {
  rawRoots: NodeInput[] | null;
  setRawRoots: React.Dispatch<React.SetStateAction<NodeInput[] | null>>;
  selectedIds: Set<string>;
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  selectedFrameId: string;
  setSelectedFrameId: React.Dispatch<React.SetStateAction<string>>;
}) {
  const { rawRoots, setRawRoots, selectedIds, setSelectedIds, selectedFrameId, setSelectedFrameId } = props;
  const [filter, setFilter] = useState("");

  const filteredNodes = (rawRoots ?? []).filter(node =>
    node.name?.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <aside className="w-64 border-r border-gray-700 bg-gray-950 text-gray-200 flex flex-col min-h-0">
      {/* Pages Section */}
      <div className="p-3 border-b border-gray-700 flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-400">Pages</span>
      </div>
      <div className="p-3 border-b border-gray-700">
        <SectionDropdown
          rawRoots={rawRoots}
          selectedId={selectedFrameId}
          setSelectedId={setSelectedFrameId}
        />
      </div>

      {/* Search Section */}
      <div className="p-3 border-b border-gray-700">
        <div className="relative">
          <input
            type="text"
            placeholder="Search layers..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full text-sm rounded-lg px-2 py-1 bg-gray-800 text-gray-50 placeholder-gray-400 border border-transparent focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">🔍</span>
        </div>
      </div>

      {/* Layers Heading */}
      <div className="p-3 flex items-center justify-between border-b border-gray-700">
        <span className="text-sm font-semibold text-gray-400">Layers</span>
      </div>

      {/* Layers Panel */}
      <div className="flex-1 overflow-y-auto">
        <LayersPanel
          layers={filteredNodes}
          setLayers={(layers) => setRawRoots(layers)}
          selectedIds={selectedIds}
          setSelectedIds={setSelectedIds}
        />
      </div>
    </aside>
  );
}