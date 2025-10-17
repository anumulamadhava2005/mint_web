import { Project } from '../types';

export interface User {
  name?: string;
  email?: string;
  handle?: string;
  img_url?: string;
}

export interface CreateProjectModalProps {
  onClose: () => void;
  onCreate: (name: string, figmaUrl: string, thumbnailFile: File | null) => Promise<void>;
}

export interface EditProjectModalProps {
  project: Project;
  onClose: () => void;
  onUpdate: (id: string, name: string, figmaUrl: string, thumbnailFile: File | null) => Promise<void>;
}

export interface ProjectListProps {
  projects: Project[];
  onSelect: (id: string) => void;
  onEdit: (id: string) => void;
}