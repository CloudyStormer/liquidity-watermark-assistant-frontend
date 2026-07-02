import { Button, Text, View } from '@tarojs/components'
import { FREE_QUOTA_PER_DAY } from '@/data/constants'
import './index.css'

interface QuotaBadgeProps {
  used: number
  total?: number
  onGainQuota: () => void
}

export default function QuotaBadge({ used, total = FREE_QUOTA_PER_DAY, onGainQuota }: QuotaBadgeProps) {
  const remaining = Math.max(0, total - used)
  const depleted = remaining === 0

  return (
    <View className='quota-card'>
      <View className='quota-left'>
        <Text className={`quota-bolt ${depleted ? 'is-warn' : ''}`}>闪</Text>
        <Text className='quota-copy'>
          今日剩余次数：
          <Text className={`quota-number ${depleted ? 'is-warn' : ''}`}>{remaining}</Text>
          <Text className='quota-total'>/{total}</Text>
        </Text>
      </View>
      <Button
        className={`quota-action ${depleted ? 'is-warn' : ''}`}
        hoverClass='quota-action-hover'
        onClick={onGainQuota}
      >
        {depleted ? '看广告+1次' : '免费使用'}
      </Button>
    </View>
  )
}
