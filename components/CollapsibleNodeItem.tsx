/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import { NodeInput } from "../lib/figma-types";

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
                            e.stopPropagation(); // Prevent parent click handler from firing
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