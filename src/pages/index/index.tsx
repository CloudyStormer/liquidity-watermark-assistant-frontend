import { useEffect, useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { Button, Image, Text, View } from '@tarojs/components'
import AdCard from '@/components/AdCard'
import BottomNav from '@/components/BottomNav'
import DisclaimerModal from '@/components/DisclaimerModal'
import QuotaBadge from '@/components/QuotaBadge'
import RewardedAdDialog from '@/components/RewardedAdDialog'
import WeChatLoginDialog from '@/components/WeChatLoginDialog'
import { FREE_QUOTA_PER_DAY } from '@/data/constants'
import { getStoredOpenid, requireLoggedIn } from '@/services/auth'
import { toApiUrl, uploadCleanupJob, waitForMediaJob } from '@/services/mediaJobs'
import { getDailyQuota, grantDailyQuota } from '@/services/quota'
import type { CleanupMethod, EditorMode, PickedMedia, WatermarkRegion } from '@/types/media'
import { formatDateTime, formatFileSize, getFileName } from '@/utils/media'
import {
  agreeDisclaimer,
  hasAgreedDisclaimer,
  saveLatestResult
} from '@/utils/storage'
import './index.css'

interface Point {
  x: number
  y: number
}

interface DraftRect {
  x: number
  y: number
  width: number
  height: number
}

interface PreviewBox {
  left: number
  top: number
  width: number
  height: number
}

interface MediaFrame {
  left: number
  top: number
  width: number
  height: number
  absoluteLeft: number
  absoluteTop: number
}

const BRUSH_SIZES = [14, 28, 44]
const UNSUPPORTED_IMAGE_EXTENSIONS = ['.webp']
const DEFAULT_METHOD: CleanupMethod = 'blur'
const MAX_BRUSH_REGIONS = 260

function clamp(value: number) {
  return Math.max(0, Math.min(1, value))
}

function rpxToPx(value: number) {
  try {
    return (value / 750) * Taro.getSystemInfoSync().windowWidth
  } catch {
    return value / 2
  }
}

function normalizeRect(rect: DraftRect): DraftRect {
  const rawX = rect.width < 0 ? rect.x + rect.width : rect.x
  const rawY = rect.height < 0 ? rect.y + rect.height : rect.y
  const x = clamp(rawX)
  const y = clamp(rawY)
  return {
    x,
    y,
    width: Math.min(1 - x, Math.abs(rect.width)),
    height: Math.min(1 - y, Math.abs(rect.height))
  }
}

function rectToRegion(rect: DraftRect, media: PickedMedia, blurRadius: number): WatermarkRegion {
  const normalized = normalizeRect(rect)
  const width = media.width || 1080
  const height = media.height || 1080
  return {
    x: Math.max(0, Math.round(normalized.x * width)),
    y: Math.max(0, Math.round(normalized.y * height)),
    width: Math.max(4, Math.round(normalized.width * width)),
    height: Math.max(4, Math.round(normalized.height * height)),
    blur_radius: blurRadius
  }
}

function getFrame(previewBox: PreviewBox, media: PickedMedia | null): MediaFrame {
  if (!media || previewBox.width <= 1 || previewBox.height <= 1) {
    return {
      left: 0,
      top: 0,
      width: Math.max(1, previewBox.width),
      height: Math.max(1, previewBox.height),
      absoluteLeft: previewBox.left,
      absoluteTop: previewBox.top
    }
  }

  const mediaWidth = media.width || previewBox.width
  const mediaHeight = media.height || previewBox.height
  const scale = Math.min(previewBox.width / mediaWidth, previewBox.height / mediaHeight)
  const width = Math.max(1, mediaWidth * scale)
  const height = Math.max(1, mediaHeight * scale)
  const left = (previewBox.width - width) / 2
  const top = (previewBox.height - height) / 2

  return {
    left,
    top,
    width,
    height,
    absoluteLeft: previewBox.left + left,
    absoluteTop: previewBox.top + top
  }
}

function distance(a: Point, b: Point) {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.sqrt(dx * dx + dy * dy)
}

function isUnsupportedImage(path: string) {
  const normalized = path.toLowerCase().split('?')[0]
  return UNSUPPORTED_IMAGE_EXTENSIONS.some((extension) => normalized.endsWith(extension))
}

function buildBrushRegions(
  strokes: Point[][],
  media: PickedMedia,
  frame: MediaFrame,
  brushSize: number
): WatermarkRegion[] {
  const brushPx = rpxToPx(brushSize)
  const radiusX = Math.max(0.004, brushPx / 2 / frame.width)
  const radiusY = Math.max(0.004, brushPx / 2 / frame.height)
  const minSpacing = Math.max(radiusX, radiusY) * 0.55
  const sampled: Point[] = []

  strokes.forEach((stroke) => {
    stroke.forEach((point) => {
      const last = sampled[sampled.length - 1]
      if (!last || distance(last, point) >= minSpacing) {
        sampled.push(point)
      }
    })
  })

  const step = sampled.length > MAX_BRUSH_REGIONS ? Math.ceil(sampled.length / MAX_BRUSH_REGIONS) : 1
  return sampled
    .filter((_, index) => index % step === 0)
    .map((point) =>
      rectToRegion(
        {
          x: point.x - radiusX,
          y: point.y - radiusY,
          width: radiusX * 2,
          height: radiusY * 2
        },
        media,
        Math.max(12, brushSize)
      )
    )
}

export default function IndexPage() {
  const [usedToday, setUsedToday] = useState(0)
  const [totalQuota, setTotalQuota] = useState(FREE_QUOTA_PER_DAY)
  const [rewardVisible, setRewardVisible] = useState(false)
  const [disclaimerVisible, setDisclaimerVisible] = useState(false)
  const [step, setStep] = useState<'pick' | 'edit' | 'processing'>('pick')
  const [selectedFile, setSelectedFile] = useState<PickedMedia | null>(null)
  const [mode, setMode] = useState<EditorMode>('brush')
  const [brushIndex, setBrushIndex] = useState(1)
  const [strokes, setStrokes] = useState<Point[][]>([])
  const [draftRect, setDraftRect] = useState<DraftRect | null>(null)
  const [dragStart, setDragStart] = useState<Point | null>(null)
  const [previewBox, setPreviewBox] = useState<PreviewBox>({ left: 0, top: 0, width: 1, height: 1 })
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [statusLabel, setStatusLabel] = useState('')

  const mediaFrame = getFrame(previewBox, selectedFile)

  useEffect(() => {
    setDisclaimerVisible(!hasAgreedDisclaimer())
  }, [])

  useDidShow(() => {
    if (getStoredOpenid()) {
      refreshQuota().catch(() => undefined)
    }
  })

  const refreshQuota = async () => {
    const quota = await getDailyQuota()
    setUsedToday(quota.used)
    setTotalQuota(quota.total)
    return quota
  }

  const loginAndRefreshQuota = async () => {
    await requireLoggedIn('登录后才能使用图片去水印，并同步今日免费次数。')
    return refreshQuota()
  }

  const syncPreviewBox = () => {
    Taro.createSelectorQuery()
      .select('.editor-preview-box')
      .boundingClientRect((rect) => {
        const box = Array.isArray(rect) ? rect[0] : rect
        if (box) {
          setPreviewBox({
            left: Number(box.left) || 0,
            top: Number(box.top) || 0,
            width: Number(box.width) || 1,
            height: Number(box.height) || 1
          })
        }
      })
      .exec()
  }

  const pickMedia = async () => {
    if (processing) {
      return
    }

    try {
      await loginAndRefreshQuota()
      const result = await Taro.chooseImage({
        count: 1,
        sourceType: ['album', 'camera'],
        sizeType: ['original', 'compressed']
      })
      const filePath = result.tempFilePaths?.[0]
      if (!filePath) {
        return
      }

      if (isUnsupportedImage(filePath)) {
        Taro.showToast({ title: '暂不支持 WebP 图片', icon: 'none' })
        return
      }

      let width = 1080
      let height = 1080
      let size = Number((result.tempFiles?.[0] as any)?.size) || 0

      try {
        const imageInfo = await Taro.getImageInfo({ src: filePath })
        if (String(imageInfo.type || '').toLowerCase() === 'webp') {
          Taro.showToast({ title: '暂不支持 WebP 图片', icon: 'none' })
          return
        }
        width = imageInfo.width
        height = imageInfo.height
        size = size || Number((imageInfo as any).size) || 0
      } catch {
        // 旧机型可能拿不到尺寸，保留默认值。
      }

      setSelectedFile({
        path: filePath,
        type: 'image',
        size,
        originalName: getFileName(filePath),
        width,
        height
      })
      setMode('brush')
      setStrokes([])
      setDraftRect(null)
      setDragStart(null)
      setStep('edit')
      setTimeout(syncPreviewBox, 180)
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      if (!message.includes('cancel') && !message.includes('取消') && !message.includes('登录')) {
        Taro.showToast({ title: '选择失败', icon: 'none' })
      }
    }
  }

  const getTouchPoint = (event: any): Point | null => {
    const touch = event.touches?.[0] || event.changedTouches?.[0]
    if (!touch || !selectedFile) {
      return null
    }

    const frame = getFrame(previewBox, selectedFile)
    return {
      x: clamp((Number(touch.clientX) - frame.absoluteLeft) / frame.width),
      y: clamp((Number(touch.clientY) - frame.absoluteTop) / frame.height)
    }
  }

  const handleTouchStart = (event) => {
    if (!selectedFile || processing) {
      return
    }

    event.stopPropagation?.()
    event.preventDefault?.()
    syncPreviewBox()
    const point = getTouchPoint(event)
    if (!point) {
      return
    }

    if (mode === 'brush') {
      setStrokes((current) => [...current, [point]])
      return
    }

    setDragStart(point)
    setDraftRect({ x: point.x, y: point.y, width: 0, height: 0 })
  }

  const handleTouchMove = (event) => {
    if (!selectedFile || processing) {
      return
    }

    event.stopPropagation?.()
    event.preventDefault?.()
    const point = getTouchPoint(event)
    if (!point) {
      return
    }

    if (mode === 'brush') {
      setStrokes((current) => {
        if (current.length === 0) {
          return [[point]]
        }
        const next = current.slice()
        const lastStroke = next[next.length - 1]
        const lastPoint = lastStroke[lastStroke.length - 1]
        if (lastPoint && distance(lastPoint, point) < 0.0025) {
          return current
        }
        next[next.length - 1] = [...lastStroke, point]
        return next
      })
      return
    }

    if (dragStart) {
      setDraftRect({
        x: dragStart.x,
        y: dragStart.y,
        width: point.x - dragStart.x,
        height: point.y - dragStart.y
      })
    }
  }

  const handleTouchEnd = (event) => {
    event?.stopPropagation?.()
    event?.preventDefault?.()
    setDragStart(null)
  }

  const clearMarks = () => {
    setStrokes([])
    setDraftRect(null)
    setDragStart(null)
  }

  const centerRect = () => {
    setMode('rect')
    setDraftRect({ x: 0.18, y: 0.08, width: 0.46, height: 0.16 })
    setStrokes([])
  }

  const currentRegions = () => {
    if (!selectedFile) {
      return []
    }

    if (mode === 'rect' && draftRect) {
      const normalized = normalizeRect(draftRect)
      if (normalized.width < 0.01 || normalized.height < 0.01) {
        return []
      }
      return [rectToRegion(normalized, selectedFile, BRUSH_SIZES[brushIndex])]
    }

    return buildBrushRegions(strokes, selectedFile, mediaFrame, BRUSH_SIZES[brushIndex])
  }

  const startProcessing = async () => {
    if (!selectedFile || processing) {
      return
    }

    const regions = currentRegions()
    if (regions.length === 0) {
      Taro.showToast({ title: '请先标记水印区域', icon: 'none' })
      return
    }

    try {
      const quota = await loginAndRefreshQuota()
      if (quota.remaining <= 0) {
        setRewardVisible(true)
        return
      }
    } catch {
      return
    }

    setProcessing(true)
    setStep('processing')
    setProgress(12)
    setStatusLabel('安全合规检测中...')

    try {
      const job = await uploadCleanupJob({
        filePath: selectedFile.path,
        method: DEFAULT_METHOD,
        regions
      })
      setProgress(28)
      setStatusLabel('检测通过，正在处理...')
      const finishedJob = await waitForMediaJob(job.id, (nextProgress, label) => {
        setProgress(nextProgress)
        setStatusLabel(label)
      })
      if (!finishedJob.result_url) {
        throw new Error('结果文件缺失')
      }
      await refreshQuota()

      saveLatestResult({
        id: finishedJob.id,
        type: finishedJob.media_type,
        originalName: finishedJob.original_filename || selectedFile.originalName,
        thumb: selectedFile.path,
        processedUrl: toApiUrl(finishedJob.result_url),
        processTime: formatDateTime(),
        fileSize: formatFileSize(selectedFile.size),
        resultMd5: finishedJob.result_md5 || undefined
      })
      setProcessing(false)
      setProgress(0)
      setStatusLabel('')
      Taro.navigateTo({ url: '/pages/result/index' })
    } catch (error) {
      setProcessing(false)
      setStep('edit')
      setProgress(0)
      setStatusLabel('')
      Taro.showModal({
        title: '处理失败',
        content: error instanceof Error ? error.message : '请稍后重试',
        showCancel: false
      })
    }
  }

  const handleWatchForQuota = () => {
    loginAndRefreshQuota()
      .then(() => grantDailyQuota(1))
      .then((quota) => {
        setUsedToday(quota.used)
        setTotalQuota(quota.total)
        setRewardVisible(false)
        Taro.showToast({ title: '已增加 1 次', icon: 'success' })
      })
      .catch(() => {
        setRewardVisible(false)
      })
  }

  const handleQuotaAction = async () => {
    try {
      const quota = await loginAndRefreshQuota()
      if (quota.remaining <= 0) {
        setRewardVisible(true)
      } else {
        Taro.showToast({ title: '可继续使用', icon: 'success' })
      }
    } catch {
      // 登录弹窗已经给出提示。
    }
  }

  const renderBrushMarks = () => {
    const brushSize = BRUSH_SIZES[brushIndex]
    const brushPx = rpxToPx(brushSize)
    return strokes.map((stroke, strokeIndex) => (
      <View key={`stroke-${strokeIndex}`}>
        {stroke.map((point, index) => {
          if (index === 0) {
            return (
              <View
                key={`dot-${strokeIndex}-${index}`}
                className='brush-dot'
                style={{
                  left: `${point.x * 100}%`,
                  top: `${point.y * 100}%`,
                  width: `${brushSize}rpx`,
                  height: `${brushSize}rpx`
                }}
              />
            )
          }

          const previous = stroke[index - 1]
          const dx = (point.x - previous.x) * mediaFrame.width
          const dy = (point.y - previous.y) * mediaFrame.height
          const length = Math.max(brushPx, Math.sqrt(dx * dx + dy * dy) + brushPx)
          const angle = Math.atan2(dy, dx) * 180 / Math.PI

          return (
            <View
              key={`seg-${strokeIndex}-${index}`}
              className='brush-segment'
              style={{
                left: `${previous.x * 100}%`,
                top: `${previous.y * 100}%`,
                width: `${length}px`,
                height: `${brushSize}rpx`,
                transform: `translateY(-50%) rotate(${angle}deg)`
              }}
            />
          )
        })}
      </View>
    ))
  }

  const renderPreview = () => {
    if (!selectedFile) {
      return null
    }

    const normalized = draftRect ? normalizeRect(draftRect) : null

    return (
      <View
        className='editor-preview-box'
        catchMove
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        <Image className='editor-media' src={selectedFile.path} mode='aspectFit' />
        <View
          className='editor-overlay'
          style={{
            left: `${mediaFrame.left}px`,
            top: `${mediaFrame.top}px`,
            width: `${mediaFrame.width}px`,
            height: `${mediaFrame.height}px`
          }}
        >
          {renderBrushMarks()}

          {normalized ? (
            <View
              className='selection-box'
              style={{
                left: `${normalized.x * 100}%`,
                top: `${normalized.y * 100}%`,
                width: `${normalized.width * 100}%`,
                height: `${normalized.height * 100}%`
              }}
            >
              <View className='selection-handle top-left' />
              <View className='selection-handle top-right' />
              <View className='selection-handle bottom-left' />
              <View className='selection-handle bottom-right' />
            </View>
          ) : null}
        </View>
      </View>
    )
  }

  if (step === 'edit' || step === 'processing') {
    return (
      <View className='editor-page fade-in' catchMove>
        <View className='editor-topbar'>
          <Button
            className='editor-back'
            hoverClass='editor-button-hover'
            onClick={() => {
              if (processing) {
                return
              }
              setStep('pick')
              setSelectedFile(null)
              clearMarks()
            }}
          >
            ‹
          </Button>
          <Text className='editor-title'>标记水印区域</Text>
          <View className='editor-top-placeholder' />
        </View>

        {step === 'processing' ? (
          <View className='processing-card'>
            <View className='processing-orb'>
              <Text>AI</Text>
            </View>
            <Text className='processing-title'>{statusLabel || '处理中...'}</Text>
            <View className='processing-track'>
              <View className='processing-fill' style={{ width: `${progress}%` }} />
            </View>
            <Text className='processing-progress'>{progress}%</Text>
          </View>
        ) : (
          renderPreview()
        )}

        <View className='editor-control-wrap'>
          <Text className='editor-hint'>
            {mode === 'brush'
              ? '用手指连续涂抹水印区域，涂抹完成后点击开始处理'
              : '拖动框选水印位置，完成后点击开始处理'}
          </Text>
          <View className='control-panel'>
            <View className='control-row'>
              <Text className='control-label'>模式:</Text>
              <Button
                className={`mode-button ${mode === 'brush' ? 'is-active' : ''}`}
                hoverClass='mode-button-hover'
                onClick={() => {
                  setMode('brush')
                  setDraftRect(null)
                }}
              >
                画笔
              </Button>
              <Button
                className={`mode-button ${mode === 'rect' ? 'is-active' : ''}`}
                hoverClass='mode-button-hover'
                onClick={() => {
                  setMode('rect')
                  setStrokes([])
                  if (!draftRect) {
                    centerRect()
                  }
                }}
              >
                框选
              </Button>
            </View>

            <View className='control-row second-row'>
              <Text className='control-label'>{mode === 'brush' ? '画笔:' : '框选:'}</Text>
              {mode === 'brush' ? (
                BRUSH_SIZES.map((size, index) => (
                  <Button
                    key={size}
                    className={`brush-size ${brushIndex === index ? 'is-active' : ''}`}
                    hoverClass='mode-button-hover'
                    onClick={() => setBrushIndex(index)}
                  >
                    <View
                      className='brush-preview'
                      style={{ width: `${Math.max(10, size)}rpx`, height: `${Math.max(10, size)}rpx` }}
                    />
                  </Button>
                ))
              ) : (
                <>
                  <Button className='utility-button' hoverClass='mode-button-hover' onClick={centerRect}>
                    居中
                  </Button>
                  <Button className='utility-button' hoverClass='mode-button-hover' onClick={clearMarks}>
                    重置
                  </Button>
                </>
              )}
              <Button className='utility-button is-right' hoverClass='mode-button-hover' onClick={clearMarks}>
                清除
              </Button>
            </View>
          </View>
        </View>

        <View className='editor-ad'>
          <AdCard />
        </View>

        <Button
          className='start-clean-button'
          hoverClass='start-clean-button-hover'
          loading={processing}
          onClick={startProcessing}
        >
          开始去水印
        </Button>

        <RewardedAdDialog
          visible={rewardVisible}
          reason='quota'
          onWatch={handleWatchForQuota}
          onClose={() => setRewardVisible(false)}
        />
        <WeChatLoginDialog />
      </View>
    )
  }

  return (
    <View className='page-shell fade-in home-page'>
      <View className='home-header'>
        <View>
          <View className='eyebrow-row'>
            <Text className='eyebrow-mark'>AI</Text>
            <Text className='eyebrow-text'>本地素材处理</Text>
          </View>
          <Text className='home-title'>图片去水印</Text>
          <Text className='home-subtitle'>上传自有图片，框选水印区域后处理</Text>
        </View>
        <View className='brand-badge'>
          <Text>去</Text>
        </View>
      </View>

      <AdCard />
      <QuotaBadge used={usedToday} total={totalQuota} onGainQuota={handleQuotaAction} />

      <View className='upload-entry-card'>
        <Button className='upload-entry' hoverClass='upload-entry-hover' onClick={pickMedia}>
          <View className='upload-entry-icon'>
            <Text>+</Text>
          </View>
          <Text className='upload-entry-title'>选择图片</Text>
          <Text className='upload-entry-desc'>支持画笔涂抹、四边形框选，后端返回处理成品</Text>
          <View className='format-list'>
            <Text>JPG</Text>
            <Text>PNG</Text>
          </View>
        </Button>
      </View>

      <View className='guide-card'>
        <View className='guide-title-row'>
          <Text className='guide-icon'>i</Text>
          <Text className='guide-title'>使用步骤</Text>
        </View>
        <View className='step-list'>
          {[
            '选择本地图片文件',
            '用画笔或框选标记水印区域',
            '后端处理后返回去水印成品'
          ].map((text, index) => (
            <View className='step-row' key={text}>
              <Text className='step-number'>{index + 1}</Text>
              <Text className='step-text'>{text}</Text>
            </View>
          ))}
        </View>
      </View>

      <View className='compliance-note'>
        <Text>仅可处理自有或已授权素材，系统不会解析第三方平台未授权链接。</Text>
      </View>

      <BottomNav current='home' />
      <RewardedAdDialog
        visible={rewardVisible}
        reason='quota'
        onWatch={handleWatchForQuota}
        onClose={() => setRewardVisible(false)}
      />
      <DisclaimerModal visible={disclaimerVisible} onAgree={() => {
        agreeDisclaimer()
        setDisclaimerVisible(false)
      }} />
      <WeChatLoginDialog />
    </View>
  )
}
