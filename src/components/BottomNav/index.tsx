import Taro from '@tarojs/taro'
import { Button, Text, View } from '@tarojs/components'
import './index.css'

interface BottomNavProps {
  current: 'home' | 'md5' | 'profile' | 'result'
}

const navItems = [
  { key: 'home', label: '首页', icon: '✦', url: '/pages/index/index' },
  { key: 'md5', label: 'MD5', icon: 'MD5', url: '/pages/md5/index' }
] as const

export default function BottomNav({ current }: BottomNavProps) {
  const go = (url: string, key: 'home' | 'md5') => {
    if (current === key) {
      return
    }

    Taro.redirectTo({ url })
  }

  return (
    <View className='bottom-nav'>
      {navItems.map((item) => {
        const active = current === item.key
        return (
          <Button
            key={item.key}
            className={`bottom-nav-item ${active ? 'is-active' : ''}`}
            hoverClass='bottom-nav-hover'
            onClick={() => go(item.url, item.key)}
          >
            <Text className='bottom-nav-icon'>{item.icon}</Text>
            <Text className='bottom-nav-label'>{item.label}</Text>
          </Button>
        )
      })}
    </View>
  )
}
