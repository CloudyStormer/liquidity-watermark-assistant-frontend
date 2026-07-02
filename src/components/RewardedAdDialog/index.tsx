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
    desc: '每看完一次广告，立即增加 1 次今日处理次数。',
    reward: '+1 次'
  },
  download: {
    title: '免费下载',
    desc: '观看一次广告后，可以保存处理好的文件。',
    reward: '解锁下载'
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
            <Text>AD</Text>
          </View>
          <Text className='reward-title'>{copy.title}</Text>
          <Text className='reward-desc'>{copy.desc}</Text>
          <View className='reward-pill'>
            <Text className='reward-pill-icon'>+</Text>
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
