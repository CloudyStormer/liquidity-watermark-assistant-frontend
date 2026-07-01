import { useState } from 'react'
import Taro, { useLoad } from '@tarojs/taro'
import { Button, Image, Text, Video, View } from '@tarojs/components'
import AdCard from '@/components/AdCard'
import BottomNav from '@/components/BottomNav'
import RewardedAdDialog from '@/components/RewardedAdDialog'
import { MOCK_RESULT } from '@/data/constants'
import { downloadToTempFile } from '@/services/mediaJobs'
import type { ProcessedFile } from '@/types/media'
import { getLatestResult } from '@/utils/storage'
import './index.css'

export default function ResultPage() {
  const [fileData, setFileData] = useState<ProcessedFile>(MOCK_RESULT)
  const [rewardVisible, setRewardVisible] = useState(false)
  const [downloaded, setDownloaded] = useState(false)

  useLoad(() => {
    setFileData(getLatestResult() || MOCK_RESULT)
  })

  const isVideo = fileData.type === 'video'

  const saveToAlbum = async () => {
    setRewardVisible(false)

    try {
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
    } catch {
      setDownloaded(true)
      Taro.showModal({
        title: '下载已解锁',
        content: '当前环境可能没有相册权限，请在小程序设置中开启后重试保存。',
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
          <Text className='result-subtitle'>预览并下载处理结果</Text>
        </View>
        <View className='success-pill'>
          <Text className='success-dot'>✓</Text>
          <Text>成功</Text>
        </View>
      </View>

      <View className='preview-card'>
        <View className='main-preview'>
          {isVideo ? (
            <Video
              className='main-media'
              src={fileData.processedUrl}
              controls
              objectFit='cover'
            />
          ) : (
            <Image
              className='main-media'
              src={fileData.processedUrl}
              mode='aspectFill'
            />
          )}
          <View className='removed-badge'>
            <Text className='removed-check'>✓</Text>
            <Text>水印已移除</Text>
          </View>
        </View>
        <View className='file-info'>
          <Text className='file-name'>{fileData.originalName}</Text>
          <View className='file-meta'>
            <Text>{isVideo ? '视频' : '图片'}</Text>
            <Text>{fileData.fileSize}</Text>
            <Text>{fileData.processTime}</Text>
          </View>
          {fileData.resultMd5 ? (
            <View className='result-md5-row'>
              <Text className='result-md5-label'>MD5</Text>
              <Text className='result-md5-value'>{fileData.resultMd5}</Text>
            </View>
          ) : null}
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
              <Video className='compare-image is-before' src={fileData.thumb} controls={false} objectFit='cover' />
            ) : (
              <Image className='compare-image is-before' src={fileData.thumb} mode='aspectFill' />
            )}
          </View>
          <View className='compare-divider' />
          <View className='compare-side'>
            <Text className='compare-label is-after'>处理后</Text>
            {isVideo ? (
              <Video className='compare-image' src={fileData.processedUrl} controls={false} objectFit='cover' />
            ) : (
              <Image className='compare-image' src={fileData.processedUrl} mode='aspectFill' />
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
              Taro.showToast({ title: '文件已下载', icon: 'none' })
              return
            }
            setRewardVisible(true)
          }}
        >
          {downloaded ? '已下载到本地' : '免费下载（看广告解锁）'}
        </Button>
        <Text className='download-tip'>观看约 15 秒广告即可免费下载</Text>
      </View>

      <AdCard variant='interstitial' />
      <BottomNav current='result' />
      <RewardedAdDialog
        visible={rewardVisible}
        reason='download'
        onWatch={saveToAlbum}
        onClose={() => setRewardVisible(false)}
      />
    </View>
  )
}
