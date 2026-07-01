import type { PickedMedia, ProcessedFile } from '@/types/media'

export function formatFileSize(size: number) {
  if (!Number.isFinite(size) || size <= 0) {
    return '未知大小'
  }

  if (size >= 1024 * 1024) {
    return `${(size / 1024 / 1024).toFixed(1)} MB`
  }

  return `${Math.max(1, Math.round(size / 1024))} KB`
}

export function getFileName(path: string) {
  const cleanPath = path.split('?')[0] || path
  return cleanPath.split('/').pop() || `素材_${Date.now()}`
}

export function formatDateTime(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, '0')
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join('-') + ' ' + [
    pad(date.getHours()),
    pad(date.getMinutes())
  ].join(':')
}

export function createProcessedFile(file: PickedMedia): ProcessedFile {
  return {
    id: `pf-${Date.now()}`,
    type: file.type,
    originalName: file.originalName || getFileName(file.path),
    thumb: file.path,
    processedUrl: file.path,
    processTime: formatDateTime(),
    fileSize: formatFileSize(file.size)
  }
}
