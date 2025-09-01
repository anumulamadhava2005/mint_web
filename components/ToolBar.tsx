/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Image from "next/image";
import { ReferenceFrame } from "../lib/figma-types";

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
    loading,
    onFetch,
    frameOptions,
    selectedFrameId,
    setSelectedFrameId,
    fitToScreen,
    openConvert,
    zoomPct,
  } = props;

  // fetch user on mount (kept here to keep page.tsx lean)
  if (typeof window !== "undefined") {
    // run once
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__userFetched__ ||= (onMountFetchUser(), true);
  }

  let fileInputVal = "";
  function handleFetch() {
    onFetch(fileInputVal);
  }

  return (
    <>
      <div className="p-3 flex items-center gap-3 border-b">
        <h1 className="text-xl font-semibold">Figma Node Visualizer</h1>
        <div className="flex-1" />
        {!user ? (
          <button onClick={onConnect} className="rounded-2xl px-4 py-2 shadow border text-sm hover:shadow-md">
            Connect Figma
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <Image src={user.img_url} alt={user.handle} width={32} height={32} className="w-8 h-8 rounded-full border" />
            <div className="text-sm">
              <div className="font-medium">@{user.handle}</div>
              {user.email && <div className="text-gray-600">{user.email}</div>}
            </div>
          </div>
        )}
      </div>

      <div className="p-3 flex items-center gap-2 border-b">
        <input
          className="flex-1 border rounded-xl px-3 py-2"
          placeholder="Paste Figma file URL or key"
          onChange={(e) => (fileInputVal = e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleFetch();
          }}
        />
        <button onClick={handleFetch} className="rounded-2xl px-4 py-2 shadow border text-sm hover:shadow-md" disabled={loading}>
          {loading ? "Fetching…" : "Fetch"}
        </button>

        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Reference frame</label>
          <select
            className="border rounded px-2 py-1 text-sm"
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
        </div>

        <button onClick={fitToScreen} className="rounded-2xl px-3 py-2 shadow border text-sm hover:shadow-md">
          Fit
        </button>
        <button onClick={openConvert} className="rounded-2xl px-3 py-2 shadow border text-sm hover:shadow-md">
          Convert
        </button>
        <div className="text-sm text-gray-700 px-2">Zoom: {zoomPct.toFixed(0)}%</div>
      </div>
    </>
  );
}
