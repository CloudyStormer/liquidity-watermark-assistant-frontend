import { useState } from 'react'
import Taro, { useLoad } from '@tarojs/taro'
import { Button, Image, Text, Video, View } from '@tarojs/components'
import AdCard from '@/components/AdCard'
import BottomNav from '@/components/BottomNav'
import WeChatLoginDialog from '@/components/WeChatLoginDialog'
import { MOCK_RESULT } from '@/data/constants'
import { requireLoggedIn } from '@/services/auth'
import { downloadToTempFile } from '@/services/mediaJobs'
import type { ProcessedFile } from '@/types/media'
import { getLatestResult } from '@/utils/storage'
import './index.css'

export default function ResultPage() {
  const [fileData, setFileData] = useState<ProcessedFile>(MOCK_RESULT)
  const [downloaded, setDownloaded] = useState(false)

  useLoad(() => {
    setFileData(getLatestResult() || MOCK_RESULT)
  })

  const isVideo = fileData.type === 'video'

  const previewImage = (current: string) => {
    if (isVideo) {
      return
    }
    Taro.previewImage({
      current,
      urls: [fileData.thumb, fileData.processedUrl].filter(Boolean)
    })
  }

  const saveToAlbum = async () => {
    try {
      await requireLoggedIn('登录后才能下载保存处理结果。')
      const localPath = /^https?:\/\//i.test(fileData.processedUrl)
        ? await downloadToTempFile(fileData.processedUrl)
        : fileData.processedUrl
      if (isVideo) {
        await Taro.saveVideoToPhotosAlbum({ filePath: localPath })
      } else {
        await Taro.saveImageToPhotosAlbum({ filePath: localPath })
      }
      setDownloaded(true)
      Taro.showToast({ title: '已保存', icon: 'success' })
    } catch (error) {
      Taro.showModal({
        title: '保存失败',
        content: error instanceof Error ? error.message : '请在小程序设置中开启相册权限后重试。',
        showCancel: false
      })
    }
  }

  return (
    <View className='page-shell fade-in result-page'>
      <View className='result-header'>
        <Button
          className='back-button'
          hoverClass='back-button-hover'
          onClick={() => Taro.redirectTo({ url: '/pages/index/index' })}
        >
          ←
        </Button>
        <View className='result-title-block'>
          <Text className='result-title'>处理完成</Text>
          <Text className='result-subtitle'>点击图片可放大查看</Text>
        </View>
      </View>

      <View className='compare-card'>
        <View className='compare-head'>
          <Text>效果对比</Text>
        </View>
        <View className='compare-body'>
          <View className='compare-side'>
            <Text className='compare-label'>处理前</Text>
            {isVideo ? (
              <Video className='compare-image' src={fileData.thumb} controls objectFit='contain' />
            ) : (
              <Image
                className='compare-image'
                src={fileData.thumb}
                mode='aspectFit'
                onClick={() => previewImage(fileData.thumb)}
              />
            )}
          </View>
          <View className='compare-divider' />
          <View className='compare-side'>
            <Text className='compare-label is-after'>处理后</Text>
            {isVideo ? (
              <Video className='compare-image' src={fileData.processedUrl} controls objectFit='contain' />
            ) : (
              <Image
                className='compare-image'
                src={fileData.processedUrl}
                mode='aspectFit'
                onClick={() => previewImage(fileData.processedUrl)}
              />
            )}
          </View>
        </View>
      </View>

      <View className='download-area'>
        <Button
          className={`download-button ${downloaded ? 'is-done' : ''}`}
          hoverClass='download-button-hover'
          onClick={() => {
            if (downloaded) {
              Taro.showToast({ title: '文件已保存', icon: 'none' })
              return
            }
            saveToAlbum()
          }}
        >
          {downloaded ? '已保存到相册' : '保存到相册'}
        </Button>
      </View>

      <AdCard variant='interstitial' />
      <BottomNav current='result' />
      <WeChatLoginDialog />
    </View>
  )
}
