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
