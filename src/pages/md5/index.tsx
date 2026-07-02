import { useState } from 'react'
import Taro from '@tarojs/taro'
import { Button, ScrollView, Text, Video, View } from '@tarojs/components'
import AdCard from '@/components/AdCard'
import BottomNav from '@/components/BottomNav'
import RewardedAdDialog from '@/components/RewardedAdDialog'
import WeChatLoginDialog from '@/components/WeChatLoginDialog'
import { requireLoggedIn } from '@/services/auth'
import { downloadToTempFile, toApiUrl, uploadMd5Variant } from '@/services/mediaJobs'
import { grantDailyQuota } from '@/services/quota'
import type { Md5FileResponse, PickedMedia } from '@/types/media'
import { formatFileSize, getFileName } from '@/utils/media'
import './index.css'

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message
  }

  const payload = error as { errMsg?: string; message?: string }
  return payload?.errMsg || payload?.message || String(error || '未知错误')
}

function isCancelError(error: unknown) {
  const message = getErrorMessage(error).toLowerCase()
  return message.includes('cancel') || message.includes('取消')
}

function toPickedVideo(file: {
  tempFilePath?: string
  name?: string
  size?: number
  duration?: number
  width?: number
  height?: number
}): PickedMedia | null {
  if (!file.tempFilePath) {
    return null
  }

  return {
    path: file.tempFilePath,
    type: 'video',
    size: Number(file.size) || 0,
    originalName: file.name || getFileName(file.tempFilePath),
    duration: Number(file.duration) || undefined,
    width: Number(file.width) || undefined,
    height: Number(file.height) || undefined
  }
}

async function pickVideoFile() {
  const errors: string[] = []

  try {
    const picked = await Taro.chooseVideo({
      sourceType: ['album'],
      compressed: false,
      maxDuration: 60
    })
    const file = toPickedVideo(picked)
    if (file) {
      return file
    }
    errors.push('系统相册未返回视频路径')
  } catch (error) {
    if (isCancelError(error)) {
      throw error
    }
    errors.push(getErrorMessage(error))
  }

  try {
    const picked = await Taro.chooseMedia({
      count: 1,
      mediaType: ['video'],
      sourceType: ['album'],
      maxDuration: 60
    })
    const file = toPickedVideo((picked.tempFiles?.[0] || {}) as any)
    if (file) {
      return file
    }
    errors.push('系统相册未返回视频路径')
  } catch (error) {
    if (isCancelError(error)) {
      throw error
    }
    errors.push(getErrorMessage(error))
  }

  throw new Error(errors.filter(Boolean).join('\n') || '选择视频失败')
}

export default function Md5Page() {
  const [selectedFile, setSelectedFile] = useState<PickedMedia | null>(null)
  const [computing, setComputing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<Md5FileResponse | null>(null)
  const [rewardVisible, setRewardVisible] = useState(false)
  const resultVideoUrl = result ? toApiUrl(result.result_url) : ''

  const chooseVideo = async () => {
    if (computing || saving) {
      return
    }

    try {
      await requireLoggedIn('登录后才能上传视频并生成新的 MD5 文件。')
      const nextFile = await pickVideoFile()
      setSelectedFile(nextFile)
      await startMd5(nextFile)
    } catch (error) {
      if (isCancelError(error)) {
        return
      }
      const message = getErrorMessage(error)
      if (message.includes('登录')) {
        return
      }
      Taro.showModal({
        title: '选择视频失败',
        content: message,
        showCancel: false
      })
    }
  }

  const startMd5 = async (file: PickedMedia) => {
    setComputing(true)
    setProgress(18)
    setResult(null)
    let timer: ReturnType<typeof setInterval> | null = null

    try {
      timer = setInterval(() => {
        setProgress((current) => Math.min(92, current + 11))
      }, 650)
      const response = await uploadMd5Variant(file.path)
      setProgress(100)
      setResult(response)
      Taro.showToast({ title: 'MD5 已修改', icon: 'success' })
    } catch (error) {
      const message = getErrorMessage(error) || '请稍后重试'
      if (message.includes('429') || message.includes('次数')) {
        setRewardVisible(true)
      } else {
        Taro.showModal({
          title: '处理失败',
          content: message,
          showCancel: false
        })
      }
    } finally {
      if (timer) {
        clearInterval(timer)
      }
      setComputing(false)
      setTimeout(() => setProgress(0), 800)
    }
  }

  const saveResult = async () => {
    if (!result || saving) {
      return
    }

    setSaving(true)
    try {
      await requireLoggedIn('登录后才能下载保存生成的新视频。')
      Taro.showLoading({ title: '保存中...' })
      const tempPath = await downloadToTempFile(result.result_url)
      await Taro.saveVideoToPhotosAlbum({ filePath: tempPath })
      Taro.hideLoading()
      Taro.showToast({ title: '已保存', icon: 'success' })
    } catch (error) {
      Taro.hideLoading()
      Taro.showModal({
        title: '保存失败',
        content: getErrorMessage(error) || '请确认相册权限已开启，或稍后重试。',
        showCancel: false
      })
    } finally {
      setSaving(false)
    }
  }

  const copyHash = async (value: string) => {
    try {
      await Taro.setClipboardData({ data: value })
    } catch {
      Taro.showToast({ title: '复制失败', icon: 'none' })
    }
  }

  const handleWatchForQuota = async () => {
    try {
      await grantDailyQuota(1)
      setRewardVisible(false)
      Taro.showToast({ title: '已增加 1 次', icon: 'success' })
      if (selectedFile) {
        await startMd5(selectedFile)
      }
    } catch {
      setRewardVisible(false)
    }
  }

  return (
    <View className='fade-in md5-page'>
      <View className='md5-header'>
        <Text>MD5 修改</Text>
      </View>

      <ScrollView className='md5-scroll' scrollY enhanced showScrollbar={false}>
        <View className='md5-scroll-inner'>
          <View className='md5-ad-row'>
            <AdCard />
          </View>

      <View className='md5-info-card'>
        <Text className='md5-info-title'>MD5 作用说明</Text>
        <Text className='md5-info-body'>
          后端会给视频写入唯一 metadata，并生成一个新副本。画面内容不变，但文件二进制和 MD5 会变成新的唯一值。
        </Text>
      </View>

      <View className='md5-upload-card'>
        <Text className='md5-upload-title'>
          {selectedFile ? selectedFile.originalName : '从系统相册选择要修改 MD5 的视频'}
        </Text>
        {selectedFile ? (
          <Text className='md5-upload-meta'>{formatFileSize(selectedFile.size)}</Text>
        ) : null}
        <Button
          className='md5-pick-button'
          hoverClass='md5-pick-button-hover'
          loading={computing}
          disabled={computing || saving}
          onClick={chooseVideo}
        >
          {selectedFile ? '重新选择视频' : '选择视频'}
        </Button>
      </View>

      {computing || progress > 0 ? (
        <View className='md5-progress-card'>
          <Text className='md5-progress-title'>正在生成唯一副本</Text>
          <View className='md5-progress-track'>
            <View className='md5-progress-fill' style={{ width: `${progress}%` }} />
          </View>
          <Text className='md5-progress-number'>{progress}%</Text>
        </View>
      ) : null}

      {result ? (
        <View className='md5-result-card'>
          <Text className='md5-result-title'>修改完成</Text>
          <View className='md5-video-preview'>
            <Video
              className='md5-video'
              src={resultVideoUrl}
              controls
              objectFit='contain'
              showCenterPlayBtn
            />
          </View>
          <Text className='md5-video-hint'>新视频可在线播放，确认无误后可保存到相册。</Text>
          <View className='hash-row'>
            <Text className='hash-label'>原 MD5</Text>
            <Text className='hash-value'>{result.original_md5}</Text>
            <Button className='hash-copy' hoverClass='hash-copy-hover' onClick={() => copyHash(result.original_md5)}>
              复制
            </Button>
          </View>
          <View className='hash-row'>
            <Text className='hash-label'>新 MD5</Text>
            <Text className='hash-value is-new'>{result.unique_md5}</Text>
            <Button className='hash-copy' hoverClass='hash-copy-hover' onClick={() => copyHash(result.unique_md5)}>
              复制
            </Button>
          </View>
          <Button
            className='save-md5-button'
            hoverClass='save-md5-button-hover'
            loading={saving}
            disabled={saving}
            onClick={saveResult}
          >
            {saving ? '保存中...' : '保存新视频'}
          </Button>
        </View>
      ) : null}

      <Text className='md5-note'>文件上传后由后端生成新副本，处理完成即可在线播放和下载保存。</Text>
        </View>
      </ScrollView>
      <BottomNav current='md5' />
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
