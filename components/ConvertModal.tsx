"use client";

import { useEffect, useRef, useState } from "react";

export default function ConvertModal(props: {
  open: boolean;
  onClose: () => void;
  onConfirm: (val: string) => void;
}) {
  const { open, onClose, onConfirm } = props;
  const [choice, setChoice] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const FRAMEWORKS = [
    { id: "nextjs", label: "Next.js" },
    { id: "react", label: "React" },
    { id: "react-native", label: "React Native" },
    { id: "vue", label: "Vue" },
    { id: "svelte", label: "Svelte" },
    { id: "flutter", label: "Flutter" },
  ];

  return (
    <div className="fixed inset-0 z-50" aria-labelledby="convert-modal-title" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div ref={ref} tabIndex={-1} className="w-full max-w-md rounded-xl bg-white shadow-lg border outline-none">
          <div className="px-4 py-3 border-b">
            <h2 id="convert-modal-title" className="text-lg font-semibold">
              Convert
            </h2>
          </div>

          <div className="p-4 space-y-3">
            <div>
              <div className="text-sm text-gray-600 mb-1">Target framework</div>
              <div className="grid gap-2">
                {FRAMEWORKS.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setChoice(c.id)}
                    className={`w-full text-left rounded-lg border px-3 py-2 hover:bg-gray-50 ${
                      choice === c.id ? "border-blue-500 ring-2 ring-blue-200" : "border-gray-200"
                    }`}
                    aria-pressed={choice === c.id}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="text-xs text-gray-500">
              Reference frame is chosen from the top toolbar and used during conversion.
            </div>
          </div>

          <div className="px-4 py-3 border-t flex items-center justify-end gap-2">
            <button onClick={onClose} className="rounded-lg px-3 py-2 text-sm border hover:bg-gray-50">
              Cancel
            </button>
            <button
              onClick={() => choice && onConfirm(choice)}
              className="rounded-lg px-3 py-2 text-sm border bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              disabled={!choice}
            >
              Convert
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
