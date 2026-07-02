import Taro from '@tarojs/taro'
import { Button, Text, View } from '@tarojs/components'
import { SUPPORT_FORMATS } from '@/data/constants'
import { getFileName } from '@/utils/media'
import type { PickedMedia } from '@/types/media'
import './index.css'

interface UploadPanelProps {
  processing: boolean
  progress: number
  statusLabel: string
  onPicked: (file: PickedMedia) => void
}

export default function UploadPanel({ processing, progress, statusLabel, onPicked }: UploadPanelProps) {
  const pickMedia = async () => {
    if (processing) {
      return
    }

    try {
      const result = await Taro.chooseMedia({
        count: 1,
        mediaType: ['image', 'video'],
        sourceType: ['album', 'camera'],
        maxDuration: 60,
        camera: 'back'
      })

      const file = result.tempFiles?.[0] as any
      if (!file?.tempFilePath) {
        return
      }

      const type = file.fileType === 'video' ? 'video' : 'image'
      onPicked({
        path: file.tempFilePath,
        type,
        size: Number(file.size) || 0,
        originalName: getFileName(file.tempFilePath),
        duration: Number(file.duration) || undefined
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      if (!message.includes('cancel')) {
        Taro.showToast({ title: '选择失败', icon: 'none' })
      }
    }
  }

  return (
    <View className='upload-wrap'>
      <Button
        className={`upload-panel ${processing ? 'is-processing' : ''}`}
        hoverClass='upload-panel-hover'
        onClick={pickMedia}
      >
        {processing ? (
          <View className='upload-state'>
            <View className='upload-orb is-spinning'>
              <Text className='upload-orb-text'>AI</Text>
            </View>
            <Text className='upload-title'>{statusLabel || '处理中...'}</Text>
            <View className='progress-track'>
              <View className='progress-fill' style={{ width: `${progress}%` }} />
            </View>
            <Text className='progress-number'>{progress}%</Text>
          </View>
        ) : (
          <View className='upload-state'>
            <View className='upload-orb'>
              <Text className='upload-orb-text'>上</Text>
            </View>
            <Text className='upload-title'>点击选择本地文件</Text>
            <Text className='upload-desc'>选择需要去除水印的图片或视频</Text>
            <View className='format-row'>
              <View className='format-pill'>
                <Text className='format-icon brand'>图</Text>
                <Text className='format-text'>{SUPPORT_FORMATS.image.join(' / ')}</Text>
              </View>
              <View className='format-pill'>
                <Text className='format-icon orange'>视</Text>
                <Text className='format-text'>{SUPPORT_FORMATS.video.join(' / ')}</Text>
              </View>
            </View>
          </View>
        )}
      </Button>
      <Text className='upload-note'>仅支持点击选择本地文件，单文件最大 200MB，视频最长 5 分钟</Text>
    </View>
  )
}
