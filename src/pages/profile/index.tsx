import { useState } from 'react'
import Taro from '@tarojs/taro'
import { Button, Input, Text, Textarea, View } from '@tarojs/components'
import BottomNav from '@/components/BottomNav'
import { submitFeedback, submitRating } from '@/services/userActions'
import './index.css'

interface MenuItem {
  id: string
  icon: string
  label: string
  value?: string
  content?: string
}

const APP_VERSION = '1.0.0'

const menuItems: MenuItem[] = [
  {
    id: 'privacy',
    icon: '隐',
    label: '隐私协议',
    content:
      '隐私协议\n\n本应用承诺不收集、不存储用户上传的任何图片或视频文件。所有处理均在本地完成或仅作临时传输，处理完毕后立即删除。我们不会将您的个人信息出售或共享给第三方。\n\n如有疑问请联系：support@example.com'
  },
  {
    id: 'terms',
    icon: '协',
    label: '用户协议',
    content:
      '用户协议\n\n使用本工具即表示您同意：\n1. 仅处理您本人拥有合法版权的素材\n2. 不将处理结果用于任何侵权行为\n3. 不用于商业用途或大批量处理\n\n违反上述条款，产生的一切法律责任由用户自行承担。'
  },
  {
    id: 'feedback',
    icon: '馈',
    label: '用户反馈'
  },
  {
    id: 'rate',
    icon: '评',
    label: '给我们评分'
  },
  {
    id: 'version',
    icon: '版',
    label: '版本信息',
    value: `v${APP_VERSION}`
  }
]

export default function ProfilePage() {
  const [modal, setModal] = useState<{ title: string; body: string } | null>(null)
  const [feedbackVisible, setFeedbackVisible] = useState(false)
  const [feedbackContent, setFeedbackContent] = useState('')
  const [feedbackContact, setFeedbackContact] = useState('')
  const [ratingVisible, setRatingVisible] = useState(false)
  const [ratingScore, setRatingScore] = useState(5)
  const [ratingComment, setRatingComment] = useState('')
  const [rateVisible, setRateVisible] = useState(false)

  const handleMenu = (item: MenuItem) => {
    if (item.content) {
      const [title, ...body] = item.content.split('\n\n')
      setModal({ title, body: body.join('\n\n') })
      return
    }

    if (item.id === 'feedback') {
      setFeedbackVisible(true)
      return
    }

    if (item.id === 'rate') {
      setRatingVisible(true)
    }
  }

  const handleSubmitFeedback = async () => {
    if (!feedbackContent.trim()) {
      Taro.showToast({ title: '请填写反馈内容', icon: 'none' })
      return
    }

    try {
      await submitFeedback(feedbackContent, feedbackContact)
      setFeedbackVisible(false)
      setFeedbackContent('')
      setFeedbackContact('')
      Taro.showToast({ title: '反馈已提交', icon: 'success' })
    } catch {
      Taro.showToast({ title: '提交失败，请稍后重试', icon: 'none' })
    }
  }

  const handleSubmitRating = async () => {
    try {
      await submitRating(ratingScore, ratingComment)
      setRatingVisible(false)
      setRatingComment('')
      setRateVisible(true)
      Taro.showToast({ title: '评分已提交', icon: 'success' })
      setTimeout(() => setRateVisible(false), 2200)
    } catch {
      Taro.showToast({ title: '提交失败，请稍后重试', icon: 'none' })
    }
  }

  return (
    <View className='page-shell fade-in profile-page'>
      <View className='profile-header'>
        <Text>我的</Text>
      </View>

      <View className='user-card'>
        <View className='avatar-mark'>
          <Text>我</Text>
        </View>
        <View>
          <Text className='user-name'>本地用户</Text>
          <Text className='user-desc'>已使用本工具，数据仅存于本机</Text>
        </View>
      </View>

      <View className='menu-card'>
        {menuItems.map((item, index) => (
          <Button
            key={item.id}
            className={`menu-row ${index < menuItems.length - 1 ? 'has-border' : ''}`}
            hoverClass={item.value ? 'none' : 'menu-row-hover'}
            onClick={() => handleMenu(item)}
          >
            <View className={`menu-icon ${item.id === 'rate' ? 'is-orange' : ''}`}>
              <Text>{item.icon}</Text>
            </View>
            <Text className='menu-label'>{item.label}</Text>
            {item.value ? (
              <Text className='menu-value'>{item.value}</Text>
            ) : (
              <Text className='menu-chevron'>›</Text>
            )}
          </Button>
        ))}
      </View>

      <View className={`rate-toast ${rateVisible ? 'is-visible' : ''}`}>
        <Text className='rate-check'>✓</Text>
        <Text>感谢您的评分，欢迎继续体验。</Text>
      </View>

      <Text className='profile-footer'>© 2026 一键去水印，仅供学习研究</Text>

      {modal ? (
        <View className='policy-mask' onClick={() => setModal(null)}>
          <View className='policy-panel' onClick={(event) => event.stopPropagation()}>
            <View className='sheet-handle' />
            <Text className='policy-title'>{modal.title}</Text>
            <Text className='policy-body'>{modal.body}</Text>
            <Button className='policy-action' hoverClass='policy-action-hover' onClick={() => setModal(null)}>
              我知道了
            </Button>
          </View>
        </View>
      ) : null}

      {feedbackVisible ? (
        <View className='policy-mask'>
          <View className='policy-panel'>
            <View className='sheet-handle' />
            <Text className='policy-title'>用户反馈</Text>
            <Textarea
              className='form-textarea'
              placeholder='请描述遇到的问题或希望增加的功能'
              value={feedbackContent}
              maxlength={3000}
              onInput={(event) => setFeedbackContent(event.detail.value)}
            />
            <Input
              className='form-input'
              placeholder='联系方式（选填）'
              value={feedbackContact}
              maxlength={120}
              onInput={(event) => setFeedbackContact(event.detail.value)}
            />
            <View className='dialog-actions'>
              <Button className='dialog-cancel' hoverClass='policy-action-hover' onClick={() => setFeedbackVisible(false)}>
                取消
              </Button>
              <Button className='dialog-submit' hoverClass='policy-action-hover' onClick={handleSubmitFeedback}>
                提交反馈
              </Button>
            </View>
          </View>
        </View>
      ) : null}

      {ratingVisible ? (
        <View className='policy-mask'>
          <View className='rating-panel'>
            <View className='sheet-handle' />
            <Text className='policy-title'>给我们评分</Text>
            <Text className='rating-desc'>请选择 1-5 星，帮助我们改进体验。</Text>
            <View className='star-row'>
              {[1, 2, 3, 4, 5].map((score) => (
                <Button
                  key={score}
                  className={`star-button ${score <= ratingScore ? 'is-active' : ''}`}
                  hoverClass='star-button-hover'
                  onClick={() => setRatingScore(score)}
                >
                  ★
                </Button>
              ))}
            </View>
            <Text className='score-copy'>{ratingScore} 星</Text>
            <Textarea
              className='form-textarea compact'
              placeholder='评价内容（选填）'
              value={ratingComment}
              maxlength={1000}
              onInput={(event) => setRatingComment(event.detail.value)}
            />
            <View className='dialog-actions'>
              <Button className='dialog-cancel' hoverClass='policy-action-hover' onClick={() => setRatingVisible(false)}>
                取消
              </Button>
              <Button className='dialog-submit' hoverClass='policy-action-hover' onClick={handleSubmitRating}>
                提交评分
              </Button>
            </View>
          </View>
        </View>
      ) : null}

      <BottomNav current='profile' />
    </View>
  )
}
