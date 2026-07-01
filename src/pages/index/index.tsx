import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { Button, Image, Picker, Text, View } from '@tarojs/components'
import AdCard from '@/components/AdCard'
import BottomNav from '@/components/BottomNav'
import DisclaimerModal from '@/components/DisclaimerModal'
import QuotaBadge from '@/components/QuotaBadge'
import RewardedAdDialog from '@/components/RewardedAdDialog'
import { FREE_QUOTA_PER_DAY } from '@/data/constants'
import { requireLoggedIn } from '@/services/auth'
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

const MODEL_OPTIONS = ['模型1(通用稳定) 快', '模型2(线条结构) 中', '模型3(精细修复) 慢']
const BRUSH_SIZES = [12, 24, 38]

function clamp(value: number) {
  return Math.max(0, Math.min(1, value))
}

function normalizeRect(rect: DraftRect): DraftRect {
  const x = rect.width < 0 ? rect.x + rect.width : rect.x
  const y = rect.height < 0 ? rect.y + rect.height : rect.y
  return {
    x: clamp(x),
    y: clamp(y),
    width: Math.min(1 - clamp(x), Math.abs(rect.width)),
    height: Math.min(1 - clamp(y), Math.abs(rect.height))
  }
}

function regionFromRect(rect: DraftRect, media: PickedMedia, blurRadius: number): WatermarkRegion {
  const normalized = normalizeRect(rect)
  const width = media.width || 1080
  const height = media.height || 1080
  return {
    x: Math.max(0, Math.round(normalized.x * width)),
    y: Math.max(0, Math.round(normalized.y * height)),
    width: Math.max(8, Math.round(normalized.width * width)),
    height: Math.max(8, Math.round(normalized.height * height)),
    blur_radius: blurRadius
  }
}

function regionFromPoints(points: Point[], media: PickedMedia, brushSize: number): WatermarkRegion | null {
  if (points.length === 0) {
    return null
  }

  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  const padding = brushSize / 750
  const left = clamp(Math.min(...xs) - padding)
  const top = clamp(Math.min(...ys) - padding)
  const right = clamp(Math.max(...xs) + padding)
  const bottom = clamp(Math.max(...ys) + padding)

  return regionFromRect(
    {
      x: left,
      y: top,
      width: Math.max(0.02, right - left),
      height: Math.max(0.02, bottom - top)
    },
    media,
    Math.max(12, brushSize)
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
  const [modelIndex, setModelIndex] = useState(1)
  const [brushIndex, setBrushIndex] = useState(1)
  const [points, setPoints] = useState<Point[]>([])
  const [draftRect, setDraftRect] = useState<DraftRect | null>(null)
  const [dragStart, setDragStart] = useState<Point | null>(null)
  const [previewBox, setPreviewBox] = useState({ left: 0, top: 0, width: 1, height: 1 })
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [statusLabel, setStatusLabel] = useState('')

  useEffect(() => {
    setDisclaimerVisible(!hasAgreedDisclaimer())
  }, [])

  const refreshQuota = async () => {
    const quota = await getDailyQuota()
    setUsedToday(quota.used)
    setTotalQuota(quota.total)
    return quota
  }

  const loginAndRefreshQuota = async () => {
    await requireLoggedIn()
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
      const result = await Taro.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
        camera: 'back'
      })
      const file = result.tempFiles?.[0] as any
      if (!file?.tempFilePath) {
        return
      }

      const type = 'image'
      let width = Number(file.width) || undefined
      let height = Number(file.height) || undefined

      try {
        const imageInfo = await Taro.getImageInfo({ src: file.tempFilePath })
        width = imageInfo.width
        height = imageInfo.height
      } catch {
        width = width || 1080
        height = height || 1080
      }

      setSelectedFile({
        path: file.tempFilePath,
        type,
        size: Number(file.size) || 0,
        originalName: getFileName(file.tempFilePath),
        duration: Number(file.duration) || undefined,
        width,
        height
      })
      setPoints([])
      setDraftRect(null)
      setStep('edit')
      setTimeout(syncPreviewBox, 180)
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      if (!message.includes('cancel') && !message.includes('微信登录失败')) {
        Taro.showToast({ title: '选择失败', icon: 'none' })
      }
    }
  }

  const getTouchPoint = (event: any): Point | null => {
    const touch = event.touches?.[0] || event.changedTouches?.[0]
    if (!touch) {
      return null
    }

    return {
      x: clamp((Number(touch.clientX) - previewBox.left) / previewBox.width),
      y: clamp((Number(touch.clientY) - previewBox.top) / previewBox.height)
    }
  }

  const handleTouchStart = (event) => {
    if (!selectedFile || processing) {
      return
    }

    syncPreviewBox()
    const point = getTouchPoint(event)
    if (!point) {
      return
    }

    if (mode === 'brush') {
      setPoints((current) => [...current, point])
      return
    }

    setDragStart(point)
    setDraftRect({ x: point.x, y: point.y, width: 0, height: 0 })
  }

  const handleTouchMove = (event) => {
    if (!selectedFile || processing) {
      return
    }

    const point = getTouchPoint(event)
    if (!point) {
      return
    }

    if (mode === 'brush') {
      setPoints((current) => [...current.slice(-90), point])
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

  const handleTouchEnd = () => {
    setDragStart(null)
  }

  const clearMarks = () => {
    setPoints([])
    setDraftRect(null)
    setDragStart(null)
  }

  const centerRect = () => {
    setMode('rect')
    setDraftRect({ x: 0.18, y: 0.08, width: 0.46, height: 0.16 })
    setPoints([])
  }

  const currentRegion = () => {
    if (!selectedFile) {
      return null
    }

    if (mode === 'rect' && draftRect) {
      const normalized = normalizeRect(draftRect)
      if (normalized.width < 0.02 || normalized.height < 0.02) {
        return null
      }
      return regionFromRect(normalized, selectedFile, BRUSH_SIZES[brushIndex])
    }

    return regionFromPoints(points, selectedFile, BRUSH_SIZES[brushIndex])
  }

  const startProcessing = async () => {
    if (!selectedFile || processing) {
      return
    }

    const region = currentRegion()
    if (!region) {
      Taro.showToast({ title: '请先标记水印区域', icon: 'none' })
      return
    }

    const quota = await loginAndRefreshQuota()
    const remaining = quota.remaining
    if (remaining <= 0) {
      setRewardVisible(true)
      return
    }

    setProcessing(true)
    setStep('processing')
    setProgress(12)
    setStatusLabel('上传素材中...')

    try {
      const method: CleanupMethod = modelIndex === 2 ? 'inpaint' : 'blur'
      const job = await uploadCleanupJob({
        filePath: selectedFile.path,
        method,
        regions: [region]
      })
      setProgress(28)
      setStatusLabel('任务已提交...')
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
      .then(() => grantDailyQuota(FREE_QUOTA_PER_DAY))
      .then((quota) => {
        setUsedToday(quota.used)
        setTotalQuota(quota.total)
        setRewardVisible(false)
        Taro.showToast({ title: '已获得次数', icon: 'success' })
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
        Taro.showToast({ title: '登录成功，可继续使用', icon: 'success' })
      }
    } catch {
      // requireLoggedIn has shown a modal.
    }
  }

  const renderPreview = () => {
    if (!selectedFile) {
      return null
    }

    const normalized = draftRect ? normalizeRect(draftRect) : null

    return (
      <View
        className='editor-preview-box'
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        <Image className='editor-media' src={selectedFile.path} mode='aspectFit' />

        {points.map((point, index) => (
          <View
            key={`${point.x}-${point.y}-${index}`}
            className='brush-dot'
            style={{
              left: `${point.x * 100}%`,
              top: `${point.y * 100}%`,
              width: `${BRUSH_SIZES[brushIndex]}rpx`,
              height: `${BRUSH_SIZES[brushIndex]}rpx`
            }}
          />
        ))}

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
    )
  }

  if (step === 'edit' || step === 'processing') {
    return (
      <View className='editor-page fade-in'>
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
          <View className='review-pill'>
            <Text>审核通过</Text>
          </View>
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
              ? '用手指涂抹水印区域，涂抹完成后点击开始处理'
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
                  setPoints([])
                  if (!draftRect) {
                    centerRect()
                  }
                }}
              >
                四边形框选
              </Button>
              <Text className='control-label model-label'>模型:</Text>
              <Picker
                mode='selector'
                range={MODEL_OPTIONS}
                value={modelIndex}
                onChange={(event) => setModelIndex(Number(event.detail.value))}
              >
                <View className='model-picker'>
                  <Text>{MODEL_OPTIONS[modelIndex]}</Text>
                  <Text className='picker-arrow'>▼</Text>
                </View>
              </Picker>
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
            <Text>＋</Text>
          </View>
          <Text className='upload-entry-title'>选择图片</Text>
          <Text className='upload-entry-desc'>支持画笔涂抹、四边形框选，后端返回处理成品和 MD5</Text>
          <View className='format-list'>
            <Text>JPG</Text>
            <Text>PNG</Text>
            <Text>WEBP</Text>
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
            '后端处理后返回成品和唯一 MD5'
          ].map((text, index) => (
            <View className='step-row' key={text}>
              <Text className='step-number'>{index + 1}</Text>
              <Text className='step-text'>{text}</Text>
            </View>
          ))}
        </View>
      </View>

      <View className='compliance-note'>
        <Text>仅可处理自有或已授权素材，系统不会解析第三方平台无授权链接。</Text>
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
    </View>
  )
}
