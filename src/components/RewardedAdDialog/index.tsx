import { Button, Text, View } from '@tarojs/components'
import './index.css'

type RewardReason = 'quota' | 'download'

interface RewardedAdDialogProps {
  visible: boolean
  reason: RewardReason
  onWatch: () => void
  onClose: () => void
}

const copyMap: Record<RewardReason, { title: string; desc: string; reward: string }> = {
  quota: {
    title: '今日次数已用完',
    desc: '观看一个短视频广告，立即获得 3 次额外处理次数。',
    reward: '+3 次处理机会'
  },
  download: {
    title: '免费下载',
    desc: '观看一个短视频广告，即可免费下载处理好的文件。',
    reward: '解锁下载权限'
  }
}

export default function RewardedAdDialog({ visible, reason, onWatch, onClose }: RewardedAdDialogProps) {
  if (!visible) {
    return null
  }

  const copy = copyMap[reason]

  return (
    <View className='reward-mask'>
      <View className='reward-dialog'>
        <View className='reward-band' />
        <Button className='reward-close' hoverClass='reward-close-hover' onClick={onClose}>
          <Text>×</Text>
        </Button>
        <View className='reward-content'>
          <View className='reward-icon'>
            <Text>播</Text>
          </View>
          <Text className='reward-title'>{copy.title}</Text>
          <Text className='reward-desc'>{copy.desc}</Text>
          <View className='reward-pill'>
            <Text className='reward-pill-icon'>礼</Text>
            <Text className='reward-pill-text'>{copy.reward}</Text>
          </View>
          <Button className='reward-primary' hoverClass='reward-primary-hover' onClick={onWatch}>
            立即观看广告
          </Button>
          <Button className='reward-secondary' hoverClass='reward-secondary-hover' onClick={onClose}>
            暂时不了
          </Button>
        </View>
      </View>
    </View>
  )
}
