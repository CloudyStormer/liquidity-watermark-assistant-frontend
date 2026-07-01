import { View, Text } from '@tarojs/components'
import './index.css'

interface AdCardProps {
  variant?: 'banner' | 'interstitial'
  label?: string
}

export default function AdCard({ variant = 'banner', label = '广告' }: AdCardProps) {
  if (variant === 'interstitial') {
    return (
      <View className='ad-card ad-card-large'>
        <View className='ad-row ad-head'>
          <Text className='ad-caption'>推广内容</Text>
          <Text className='ad-label'>{label}</Text>
        </View>
        <View className='ad-row ad-body'>
          <View className='ad-thumb shimmer' />
          <View className='ad-lines'>
            <View className='ad-line ad-line-full shimmer' />
            <View className='ad-line ad-line-mid shimmer' />
            <View className='ad-line ad-line-short shimmer' />
          </View>
        </View>
        <View className='ad-row ad-foot'>
          <View className='ad-line ad-line-mid shimmer' />
          <View className='ad-button shimmer' />
        </View>
      </View>
    )
  }

  return (
    <View className='ad-card ad-card-banner'>
      <View className='ad-row'>
        <View className='ad-icon shimmer' />
        <View className='ad-lines'>
          <View className='ad-line ad-line-mid shimmer' />
          <View className='ad-line ad-line-short shimmer' />
        </View>
      </View>
      <View className='ad-end'>
        <Text className='ad-label'>{label}</Text>
        <View className='ad-mini shimmer' />
      </View>
    </View>
  )
}
