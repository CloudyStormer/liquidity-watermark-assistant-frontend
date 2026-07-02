export type MediaKind = 'image' | 'video'
export type CleanupMethod = 'blur' | 'inpaint'
export type EditorMode = 'brush' | 'rect'

export interface PickedMedia {
  path: string
  type: MediaKind
  size: number
  originalName: string
  duration?: number
  width?: number
  height?: number
}

export interface ProcessedFile {
  id: string
  type: MediaKind
  originalName: string
  thumb: string
  processedUrl: string
  processTime: string
  fileSize: string
  resultMd5?: string
}

export interface WatermarkRegion {
  x: number
  y: number
  width: number
  height: number
  blur_radius?: number
}

export interface MediaJobResponse {
  id: string
  openid: string
  media_type: MediaKind
  original_filename: string
  method: CleanupMethod
  status: 'queued' | 'running' | 'succeeded' | 'failed'
  regions: WatermarkRegion[]
  error?: string | null
  result_url?: string | null
  result_md5?: string | null
  created_at: string
  updated_at: string
}

export interface Md5FileResponse {
  id: string
  openid: string
  media_type: MediaKind
  original_filename: string
  file_size: number
  original_md5: string
  unique_md5: string
  result_url: string
  created_at: string
}

export interface DailyQuotaResponse {
  openid: string
  date: string
  total: number
  used: number
  remaining: number
}

export interface UserResponse {
  openid: string
  nickname?: string
  avatar_url?: string
  created_at?: string
  updated_at?: string
  last_login_at?: string
}

export interface UserProfileResponse {
  user: UserResponse
  usage_total: number
  total_jobs: number
  succeeded_jobs: number
  failed_jobs: number
  ratings_count: number
  feedback_count: number
  latest_rating_score?: number | null
  latest_rating_comment?: string | null
  latest_rating_at?: string | null
}

export interface RatingResponse {
  id: string
  openid: string
  score: number
  comment?: string | null
  job_id?: string | null
  created_at: string
}
