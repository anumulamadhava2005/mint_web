/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Image from "next/image";
import { ReferenceFrame } from "../lib/figma-types";
import { useState } from "react";

type FrameOption = ReferenceFrame;

export default function Toolbar(props: {
  user: any;
  onConnect: () => void;
  onMountFetchUser: () => void;
  fileName: string | null;
  loading: boolean;
  onFetch: (fileUrlOrKey: string) => void;
  frameOptions: FrameOption[];
  selectedFrameId: string;
  setSelectedFrameId: (v: string) => void;
  fitToScreen: () => void;
  openConvert: () => void;
  zoomPct: number;
}) {
  const {
    user,
    onConnect,
    onMountFetchUser,
    fileName,
    loading,
    onFetch,
    frameOptions,
    selectedFrameId,
    setSelectedFrameId,
    fitToScreen,
    openConvert,
    zoomPct,
  } = props;

  const [fileInputVal, setFileInputVal] = useState("");

  // fetch user on mount (kept here to keep page.tsx lean)
  if (typeof window !== "undefined") {
    // run once
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__userFetched__ ||= (onMountFetchUser(), true);
  }

  function handleFetch() {
    onFetch(fileInputVal);
  }

  return (
    <div className="bg-gray-900 border-b border-gray-800">
      {/* Top Row - Branding and User */}
      <div className="px-4 py-2 flex items-center gap-3 border-b border-gray-800">
        <h1 className="text-lg font-semibold text-white">Figma Node Visualizer</h1>
        <div className="flex-1" />
        {!user ? (
          <button 
            onClick={onConnect} 
            className="rounded-lg px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
          >
            Connect Figma
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <Image 
              src={user.img_url} 
              alt={user.handle} 
              width={28} 
              height={28} 
              className="w-7 h-7 rounded-full border border-gray-700" 
            />
            <div className="text-xs">
              <div className="font-medium text-gray-200">@{user.handle}</div>
              {user.email && <div className="text-gray-500">{user.email}</div>}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Row - Controls */}
      <div className="px-4 py-2 flex items-center gap-3">
        {/* File Input */}
        <input
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Paste Figma file URL or key"
          value={fileInputVal}
          onChange={(e) => setFileInputVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleFetch();
          }}
        />
        
        <button 
          onClick={handleFetch} 
          className="rounded-lg px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors" 
          disabled={loading}
        >
          {loading ? "Fetching…" : "Fetch"}
        </button>

        {/* Divider */}
        <div className="h-6 w-px bg-gray-700" />

        {/* Frame Selector */}
        {frameOptions.length > 0 && (
          <>
            <label className="text-xs text-gray-400">Reference frame</label>
            <select
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={selectedFrameId}
              onChange={(e) => setSelectedFrameId(e.target.value)}
              title="Choose a frame to anchor coordinates and preview overlay"
            >
              <option value="">World origin</option>
              {frameOptions.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name || f.id} ({Math.round(f.width)}×{Math.round(f.height)})
                </option>
              ))}
            </select>
            <div className="h-6 w-px bg-gray-700" />
          </>
        )}

        {/* Action Buttons */}
        <button 
          onClick={fitToScreen} 
          className="rounded-lg px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-200 text-sm font-medium transition-colors"
        >
          Fit
        </button>
        
        <button 
          onClick={openConvert} 
          className="rounded-lg px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-200 text-sm font-medium transition-colors"
        >
          Convert
        </button>

        {/* Zoom Display */}
        <div className="text-xs text-gray-400 px-2 min-w-[70px] text-right">
          {zoomPct.toFixed(0)}%
        </div>
      </div>

      {/* File Name Row */}
      {fileName && (
        <div className="px-4 py-1.5 bg-gray-850 border-t border-gray-800 text-xs text-gray-400">
          <span className="text-gray-500">File:</span> <span className="text-gray-300">{fileName}</span>
        </div>
      )}
    </div>
  );
}