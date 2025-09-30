/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { NodeInput } from "../lib/figma-types";
import { useState } from "react";
import React from "react";

function CollapsibleNodeItem({ node, selectedIds, onSelect }: {
    node: NodeInput;
    selectedIds: Set<string>;
    onSelect: (id: string, isMulti: boolean) => void;
}) {
    const isSelected = selectedIds.has(node.id);
    const hasChildren = node.children && node.children.length > 0;
    const [isExpanded, setIsExpanded] = useState(true);

    return (
        <div>
            <div
                className={`py-1 px-2 cursor-pointer rounded text-xs truncate flex items-center gap-2 ${isSelected ? 'bg-cyan-600 font-medium text-white' : 'hover:bg-gray-800'}`}
                onClick={(e) => onSelect(node.id, e.ctrlKey || e.metaKey)}
            >
                {hasChildren && (
                    <span
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsExpanded(!isExpanded);
                        }}
                        className="transition-transform duration-200 transform"
                        style={{ rotate: isExpanded ? '90deg' : '0deg' }}
                    >
                        ▶
                    </span>
                )}
                <span className="flex-1 min-w-0">{node.name || `[${node.type}]`}</span>
            </div>
            {hasChildren && isExpanded && (
                <div className="pl-4 border-l border-gray-700">
                    {node.children!.map((child) => (
                        <CollapsibleNodeItem
                            key={child.id}
                            node={child}
                            selectedIds={selectedIds}
                            onSelect={onSelect}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

export default function LayersPanel(props: {
    rawRoots: NodeInput[] | null;
    selectedIds: Set<string>;
    setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
}) {
    const { rawRoots, selectedIds, setSelectedIds } = props;

    const handleSelect = (id: string, isMulti: boolean) => {
        setSelectedIds((prev: Set<string>) => {
            const next = new Set<string>(prev);
            if (isMulti) {
                if (next.has(id)) next.delete(id);
                else next.add(id);
            } else {
                next.clear();
                next.add(id);
            }
            return next;
        });
    };

    if (!rawRoots) return null;

    return (
        <div className="space-y-1">
            {rawRoots.map((node) => (
                <CollapsibleNodeItem
                    key={node.id}
                    node={node}
                    selectedIds={selectedIds}
                    onSelect={handleSelect}
                />
            ))}
        </div>
    );
}