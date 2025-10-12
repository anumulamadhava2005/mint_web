// components/StyledComponents.ts
import styled from 'styled-components';
import { motion } from 'framer-motion';

// 1. Main Layout Components
export const AppContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  background-color: #1a1d21;
  color: #e2e8f0;
  font-family: 'Inter', sans-serif;
`;

export const MainContent = styled.div`
  display: flex;
  flex: 1;
  overflow: hidden;
`;

export const CanvasWrapper = styled.main`
  flex: 1;
  position: relative;
  background-color: #24282f;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
`;

// 2. Toolbar
export const ToolbarContainer = styled(motion.header)`
  height: 60px;
  display: flex;
  align-items: center;
  padding: 0 1.5rem;
  background-color: #1a1d21;
  border-bottom: 1px solid #323843;
  flex-shrink: 0;
  z-index: 10;
`;

// 3. Side Panels
export const Panel = styled(motion.aside)`
  width: 280px;
  background-color: #1e2227;
  border-left: 1px solid #323843;
  border-right: 1px solid #323843;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
`;

export const PanelHeader = styled.div`
  padding: 1rem 1.5rem;
  font-size: 1rem;
  font-weight: 600;
  color: #cbd5e1;
  border-bottom: 1px solid #323843;
  flex-shrink: 0;
`;

export const PanelContent = styled.div`
  padding: 1.5rem;
  overflow-y: auto;
  flex: 1;
`;

// 4. Draggable List Item (for Sidebar)
export const LayerItem = styled.div<{ isDragging: boolean }>`
  padding: 10px 14px;
  margin-bottom: 6px;
  background-color: ${(props) => (props.isDragging ? '#4f46e5' : '#323843')};
  border-radius: 6px;
  font-size: 0.9rem;
  color: ${(props) => (props.isDragging ? '#ffffff' : '#e2e8f0')};
  transition: background-color 0.2s ease-in-out, transform 0.2s ease-in-out;
  user-select: none;
  display: flex;
  align-items: center;
  box-shadow: ${(props) => (props.isDragging ? '0 4px 12px rgba(0,0,0,0.3)' : 'none')};
  cursor: grab;
  &:active {
    cursor: grabbing;
  }
`;