'use client';

import { useState, useEffect, KeyboardEvent } from 'react';
import Dock from './dock';
import styles from './css/FrameDock.module.css';
import { Plus, Edit, Share } from 'lucide-react'; 

type Frame = { id: string; name?: string };

interface FrameDockProps {
  selectedFrame: Frame | null;
  onNewFrame: () => void;
  onRenameFrame: (newName: string) => void;
  onAddConnection: () => void;
}

export default function FrameDock({
  selectedFrame,
  onNewFrame,
  onRenameFrame,
  onAddConnection,
}: FrameDockProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [nameInput, setNameInput] = useState(selectedFrame?.name || '');

  useEffect(() => {
    if (selectedFrame) {
      setNameInput(selectedFrame.name || '');
    }
    setIsRenaming(false);
  }, [selectedFrame]);

  const handleRenameConfirm = () => {
    if (nameInput.trim() && nameInput.trim() !== selectedFrame?.name) {
      onRenameFrame(nameInput.trim());
    }
    setIsRenaming(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleRenameConfirm();
    if (e.key === 'Escape') setIsRenaming(false);
  };

  const dockItems = [
    {
      icon: <Plus color="#000" size={24} />,
      label: 'New Frame',
      onClick: onNewFrame,
    },
  ];

  if (selectedFrame) {
    dockItems.push(
      {
        icon: <Edit color="#000" size={24} />,
        label: `Rename "${selectedFrame?.name || 'Frame'}"`,
        onClick: () => setIsRenaming(true),
      },
      {
        icon: <Share color="#000" size={24} />,
        label: 'Connect',
        onClick: onAddConnection,
      }
    );
  }

  return (
    <div className={styles.dockContainer}>
      {isRenaming && selectedFrame ? (
        <div className={styles.renameContainer}>
          <input
            type="text"
            className={styles.renameInput}
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleRenameConfirm}
            autoFocus
          />
          <button onClick={handleRenameConfirm} className={styles.renameButton}>
            Save
          </button>
        </div>
      ) : (
        <Dock 
          items={dockItems} 
          panelHeight={45}
          baseItemSize={32}
          magnification={50}
          spring={{ mass: 0.5, stiffness: 400, damping: 20 }}
        />
      )}
    </div>
  );
}
