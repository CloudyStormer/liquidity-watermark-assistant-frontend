import { Button, Text, View } from '@tarojs/components'
import { DISCLAIMER_TEXT } from '@/data/constants'
import './index.css'

interface DisclaimerModalProps {
  visible: boolean
  onAgree: () => void
}

const notes = [
  '仅处理您本人拥有版权的图片或视频',
  '处理结果仅供个人使用，不得传播',
  '本工具不存储您上传的任何文件'
]

export default function DisclaimerModal({ visible, onAgree }: DisclaimerModalProps) {
  if (!visible) {
    return null
  }

  return (
    <View className='disclaimer-mask'>
      <View className='disclaimer-panel'>
        <View className='sheet-handle' />
        <View className='disclaimer-head'>
          <View className='disclaimer-icon'>
            <Text>盾</Text>
          </View>
          <View>
            <Text className='disclaimer-title'>使用须知</Text>
            <Text className='disclaimer-subtitle'>请仔细阅读并同意以下条款</Text>
          </View>
        </View>
        <View className='disclaimer-copy'>
          <Text>{DISCLAIMER_TEXT}</Text>
        </View>
        <View className='disclaimer-points'>
          {notes.map((item) => (
            <View className='disclaimer-point' key={item}>
              <Text className='point-check'>✓</Text>
              <Text className='point-text'>{item}</Text>
            </View>
          ))}
        </View>
        <Button className='disclaimer-action' hoverClass='disclaimer-action-hover' onClick={onAgree}>
          我已阅读并同意
        </Button>
        <Text className='disclaimer-footnote'>不同意则无法使用本工具</Text>
      </View>
    </View>
  )
}
