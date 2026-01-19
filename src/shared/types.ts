// Database models
export interface Project {
  id: number;
  name: string;
  prompt: string | null;
  created_at: string;
  updated_at: string;
}

export interface Photo {
  id: number;
  project_id: number;
  original_filename: string;
  original_path: string;
  thumbnail_path: string;
  file_hash: string;
  file_size: number | null;
  score: number | null;
  ai_comment: string | null;
  selected: number; // SQLite boolean (0 or 1)
  similarity_group_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface PromptTemplate {
  id: number;
  name: string;
  prompt: string;
  is_preset: number;
  created_at: string;
}

// API types
export interface UploadResult {
  uploaded: number;
  duplicates: number;
  photos: Photo[];
}

export interface UploadProgress {
  current: number;
  total: number;
  filename: string;
}

export interface AnalysisProgress {
  current: number;
  total: number;
  message: string;
}

export interface CostEstimate {
  photoCount: number;
  batchCount: number;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedCost: number;
  formattedCost: string;
}

export interface Settings {
  storagePath: string;
  hasApiKey: boolean;
  promptTemplates: PromptTemplate[];
}

export interface ApiKeyValidationResult {
  success: boolean;
  error?: string;
}

// Project stats for list view
export interface ProjectWithStats extends Project {
  photo_count: number;
  selected_count: number;
  scored_count: number;
}
