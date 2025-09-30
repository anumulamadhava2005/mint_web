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
    <aside style={{
      width: '240px',
      borderRight: '1px solid #2C2C2C',
      backgroundColor: '#0D1117',
      color: '#E6EDF3',
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
      overflow: 'hidden'
    }}>
      {/* Pages Section Header */}
      <div style={{
        padding: '8px 12px',
        borderBottom: '1px solid #2C2C2C',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <span style={{
          fontSize: '11px',
          fontWeight: 600,
          color: '#8B949E',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>Pages</span>
      </div>
      
      {/* Pages Dropdown */}
      <div style={{
        padding: '8px 12px',
        borderBottom: '1px solid #2C2C2C'
      }}>
        <SectionDropdown
          rawRoots={rawRoots}
          selectedId={selectedFrameId}
          setSelectedId={setSelectedFrameId}
        />
      </div>

      {/* Search Section */}
      <div style={{
        padding: '8px 12px',
        borderBottom: '1px solid #2C2C2C'
      }}>
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            placeholder="Search layers..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{
              width: '100%',
              fontSize: '12px',
              borderRadius: '6px',
              padding: '6px 8px',
              backgroundColor: '#161B22',
              color: '#E6EDF3',
              border: '1px solid #30363D',
              outline: 'none'
            }}
            onFocus={(e) => e.target.style.border = '1px solid #388BFD'}
            onBlur={(e) => e.target.style.border = '1px solid #30363D'}
          />
          <span style={{
            position: 'absolute',
            right: '8px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: '#8B949E',
            fontSize: '11px',
            pointerEvents: 'none'
          }}>
            🔍
          </span>
        </div>
      </div>

      {/* Layers Heading */}
      <div style={{
        padding: '8px 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid #2C2C2C'
      }}>
        <span style={{
          fontSize: '11px',
          fontWeight: 600,
          color: '#8B949E',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>Layers</span>
      </div>

      {/* Layers Panel - Scrollable */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        overflowX: 'hidden'
      }}>
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