import { useState } from 'react'
import Taro from '@tarojs/taro'
import { Button, Text, View } from '@tarojs/components'
import AdCard from '@/components/AdCard'
import BottomNav from '@/components/BottomNav'
import { requireLoggedIn } from '@/services/auth'
import { downloadToTempFile, uploadMd5Variant } from '@/services/mediaJobs'
import type { Md5FileResponse, PickedMedia } from '@/types/media'
import { formatFileSize, getFileName } from '@/utils/media'
import './index.css'

export default function Md5Page() {
  const [selectedFile, setSelectedFile] = useState<PickedMedia | null>(null)
  const [computing, setComputing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<Md5FileResponse | null>(null)

  const chooseVideo = async () => {
    if (computing) {
      return
    }

    try {
      await requireLoggedIn()
      const picked = await Taro.chooseMedia({
        count: 1,
        mediaType: ['video'],
        sourceType: ['album', 'camera'],
        maxDuration: 300,
        camera: 'back'
      })
      const file = picked.tempFiles?.[0] as any
      if (!file?.tempFilePath) {
        return
      }

      const nextFile: PickedMedia = {
        path: file.tempFilePath,
        type: 'video',
        size: Number(file.size) || 0,
        originalName: getFileName(file.tempFilePath),
        duration: Number(file.duration) || undefined
      }
      setSelectedFile(nextFile)
      await startMd5(nextFile)
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      if (!message.includes('cancel') && !message.includes('微信登录失败')) {
        Taro.showToast({ title: '选择失败', icon: 'none' })
      }
    }
  }

  const startMd5 = async (file: PickedMedia) => {
    setComputing(true)
    setProgress(18)
    setResult(null)

    try {
      const timer = setInterval(() => {
        setProgress((current) => Math.min(92, current + 11))
      }, 650)
      const response = await uploadMd5Variant(file.path)
      clearInterval(timer)
      setProgress(100)
      setResult(response)
      Taro.showToast({ title: 'MD5 已修改', icon: 'success' })
    } catch (error) {
      Taro.showModal({
        title: '处理失败',
        content: error instanceof Error ? error.message : '请稍后重试',
        showCancel: false
      })
    } finally {
      setComputing(false)
      setTimeout(() => setProgress(0), 800)
    }
  }

  const saveResult = async () => {
    if (!result) {
      return
    }

    try {
      const tempPath = await downloadToTempFile(result.result_url)
      await Taro.saveVideoToPhotosAlbum({ filePath: tempPath })
      Taro.showToast({ title: '已保存', icon: 'success' })
    } catch {
      Taro.showModal({
        title: '保存失败',
        content: '请确认相册权限已开启，或稍后重试。',
        showCancel: false
      })
    }
  }

  const copyHash = async (value: string) => {
    try {
      await Taro.setClipboardData({ data: value })
    } catch {
      Taro.showToast({ title: '复制失败', icon: 'none' })
    }
  }

  const showFeatureInfo = () => {
    Taro.showModal({
      title: 'MD5 修改说明',
      content: '系统会在后端为视频写入唯一 metadata，并生成一个新的副本。画面内容不变，但文件二进制和 MD5 会变成新的唯一值。',
      showCancel: false,
      confirmText: '知道了'
    })
  }

  return (
    <View className='page-shell fade-in md5-page'>
      <View className='md5-header'>
        <Text>MD5 修改</Text>
      </View>

      <View className='md5-ad-row'>
        <View className='md5-ad-left'>
          <AdCard />
        </View>
        <View className='md5-ad-copy'>
          <View className='ad-avatar' />
          <Text className='ad-title'>视频文件唯一值工具</Text>
          <Text className='ad-subtitle'>写入唯一 metadata，生成新的本地副本</Text>
          <Button className='ad-action' hoverClass='ad-action-hover' onClick={showFeatureInfo}>
            了解功能
          </Button>
        </View>
      </View>

      <View className='md5-upload-card'>
        <Text className='md5-upload-title'>
          {selectedFile ? selectedFile.originalName : '从手机里选择要修改 MD5 的视频'}
        </Text>
        {selectedFile ? (
          <Text className='md5-upload-meta'>{formatFileSize(selectedFile.size)}</Text>
        ) : null}
        <Button
          className='md5-pick-button'
          hoverClass='md5-pick-button-hover'
          loading={computing}
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
          <Button className='save-md5-button' hoverClass='save-md5-button-hover' onClick={saveResult}>
            保存新视频
          </Button>
        </View>
      ) : null}

      <Text className='md5-note'>注：文件会上传到后端生成新副本，处理完成后可下载保存。</Text>
      <BottomNav current='md5' />
    </View>
  )
}
