export interface Project {
  id: string;
  userId: string;
  name: string;
  fileKey: string;
  rawRoots?: any[];
  frameCount: number;
  thumbnail?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface APIResponse<T> {
  success: boolean;
  error?: string;
  details?: string[];
  project?: T;
  projects?: T[];
  total?: number;
  limit?: number;
  offset?: number;
}

export interface APIError {
  success: false;
  error: string;
  details?: string[];
}