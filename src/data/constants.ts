import type { ProcessedFile } from '@/types/media'

export const FREE_QUOTA_PER_DAY = 3

export const QUOTA_STORAGE_KEY = 'wm_quota'
export const DISCLAIMER_STORAGE_KEY = 'wm_disclaimer_agreed'
export const RESULT_STORAGE_KEY = 'wm_latest_result'

export const DISCLAIMER_TEXT =
  '本工具仅供个人学习与研究使用。仅可处理自有版权素材，侵权责任由使用者自行承担。严禁用于任何侵犯他人版权、肖像权或隐私权的行为。'

export const SUPPORT_FORMATS = {
  image: ['JPG', 'PNG', 'WEBP', 'HEIC'],
  video: ['MP4', 'MOV', 'AVI', 'MKV']
}

export const PROCESS_STAGES = [
  { label: '内容安全检测中...', pct: 20 },
  { label: '分析水印区域...', pct: 45 },
  { label: '智能修复中...', pct: 72 },
  { label: '输出优化...', pct: 90 },
  { label: '处理完成', pct: 100 }
]

export const MOCK_RESULT: ProcessedFile = {
  id: 'pf-demo',
  type: 'image',
  originalName: '风景照片_原图.jpg',
  thumb: 'https://picsum.photos/seed/wm-demo/640/420',
  processedUrl: 'https://picsum.photos/seed/wm-demo-clean/640/420',
  processTime: '2026-07-01 12:00',
  fileSize: '2.4 MB'
}
