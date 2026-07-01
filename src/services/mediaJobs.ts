import Taro from '@tarojs/taro'
import { API_BASE_URL } from '@/config/api'
import type {
  CleanupMethod,
  Md5FileResponse,
  MediaJobResponse,
  WatermarkRegion
} from '@/types/media'
import { ensureLoggedIn } from './auth'
import { requestJson } from './request'

interface UploadCleanupOptions {
  filePath: string
  method: CleanupMethod
  regions: WatermarkRegion[]
}

function parseUploadResponse<T>(response: Taro.uploadFile.SuccessCallbackResult): T {
  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(`Upload failed: ${response.statusCode}`)
  }

  return JSON.parse(response.data || '{}') as T
}

export function toApiUrl(path: string) {
  if (/^https?:\/\//i.test(path)) {
    return path
  }

  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`
}

export async function uploadCleanupJob(options: UploadCleanupOptions) {
  const openid = await ensureLoggedIn()
  const response = await Taro.uploadFile({
    url: toApiUrl('/media/jobs/upload'),
    filePath: options.filePath,
    name: 'file',
    formData: {
      openid,
      rights_confirmed: 'true',
      method: options.method,
      regions_json: JSON.stringify(options.regions)
    }
  })

  return parseUploadResponse<MediaJobResponse>(response)
}

export async function getMediaJob(jobId: string) {
  const openid = await ensureLoggedIn()
  return requestJson<MediaJobResponse>(`/media/jobs/${jobId}?openid=${encodeURIComponent(openid)}`)
}

export async function waitForMediaJob(
  jobId: string,
  onProgress?: (progress: number, label: string) => void
) {
  const startedAt = Date.now()
  const timeoutMs = 1000 * 120

  while (Date.now() - startedAt < timeoutMs) {
    const job = await getMediaJob(jobId)
    if (job.status === 'succeeded') {
      onProgress?.(100, '处理完成')
      return job
    }
    if (job.status === 'failed') {
      throw new Error(job.error || '处理失败')
    }

    const elapsed = Date.now() - startedAt
    const progress = Math.min(92, 22 + Math.floor(elapsed / 1400) * 8)
    onProgress?.(progress, job.status === 'running' ? '后端处理中...' : '任务排队中...')
    await new Promise((resolve) => setTimeout(resolve, 1600))
  }

  throw new Error('处理超时，请稍后在记录中查看')
}

export async function uploadMd5Variant(filePath: string) {
  const openid = await ensureLoggedIn()
  const response = await Taro.uploadFile({
    url: toApiUrl('/media/md5/upload'),
    filePath,
    name: 'file',
    formData: {
      openid,
      rights_confirmed: 'true'
    }
  })

  return parseUploadResponse<Md5FileResponse>(response)
}

export async function downloadToTempFile(url: string) {
  const response = await Taro.downloadFile({
    url: toApiUrl(url)
  })

  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(`Download failed: ${response.statusCode}`)
  }

  return response.tempFilePath
}
