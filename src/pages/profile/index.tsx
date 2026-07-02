import { useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { Button, Image, Input, Text, Textarea, View } from '@tarojs/components'
import BottomNav from '@/components/BottomNav'
import WeChatLoginDialog from '@/components/WeChatLoginDialog'
import { getStoredOpenid, getStoredUser, requireLoggedIn, type LoginResponse } from '@/services/auth'
import { toApiUrl } from '@/services/mediaJobs'
import { getDailyQuota } from '@/services/quota'
import { submitFeedback, submitRating } from '@/services/userActions'
import type { DailyQuotaResponse } from '@/types/media'
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
    id: 'privacy',
    icon: '隐',
    label: '隐私协议',
    content:
      '隐私协议\n\n本应用仅为处理自有或已授权素材提供工具能力。上传素材仅用于本次处理和临时下载，建议您不要上传含敏感隐私的信息。\n\n如有疑问请联系：support@example.com'
  },
  {
    id: 'terms',
    icon: '协',
    label: '用户协议',
    content:
      '用户协议\n\n使用本工具即表示您同意：\n1. 仅处理您本人拥有合法版权或授权的素材\n2. 不将处理结果用于任何侵权行为\n3. 不上传违法、侵权或侵犯隐私的内容\n\n违反上述条款产生的责任由用户自行承担。'
  },
  {
    id: 'version',
    icon: '版',
    label: '版本信息',
    value: `v${APP_VERSION}`
  }
]

export default function ProfilePage() {
  const [user, setUser] = useState<LoginResponse | null>(() => getStoredUser())
  const [quota, setQuota] = useState<DailyQuotaResponse | null>(null)
  const [modal, setModal] = useState<{ title: string; body: string } | null>(null)
  const [feedbackVisible, setFeedbackVisible] = useState(false)
  const [feedbackContent, setFeedbackContent] = useState('')
  const [feedbackContact, setFeedbackContact] = useState('')
  const [ratingVisible, setRatingVisible] = useState(false)
  const [ratingScore, setRatingScore] = useState(5)
  const [ratingComment, setRatingComment] = useState('')
  const [rateVisible, setRateVisible] = useState(false)

  const loggedOpenid = user?.openid || getStoredOpenid()
  const isLoggedIn = Boolean(loggedOpenid)
  const avatarUrl = user?.avatar_url ? toApiUrl(user.avatar_url) : ''

  const refreshProfile = async () => {
    const storedUser = getStoredUser()
    if (storedUser) {
      setUser(storedUser)
    }

    if (!getStoredOpenid()) {
      setQuota(null)
      return
    }

    try {
      const nextQuota = await getDailyQuota()
      setQuota(nextQuota)
      setUser(getStoredUser() || storedUser)
    } catch {
      setQuota(null)
    }
  }

  useDidShow(() => {
    refreshProfile()
  })

  const handleLogin = async () => {
    try {
      await requireLoggedIn('登录后可查看微信头像、昵称和今日使用次数。')
      await refreshProfile()
    } catch {
      // requireLoggedIn has shown a modal unless the user cancelled.
    }
  }

  const handleMenu = async (item: MenuItem) => {
    if (item.content) {
      const [title, ...body] = item.content.split('\n\n')
      setModal({ title, body: body.join('\n\n') })
      return
    }

    if (item.id === 'feedback') {
      try {
        await requireLoggedIn('登录后才能提交用户反馈。')
        await refreshProfile()
        setFeedbackVisible(true)
      } catch {
        // User cancelled login.
      }
      return
    }

    if (item.id === 'rate') {
      try {
        await requireLoggedIn('登录后才能提交评分。')
        await refreshProfile()
        setRatingVisible(true)
      } catch {
        // User cancelled login.
      }
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
    } catch (error) {
      Taro.showToast({
        title: error instanceof Error ? error.message.slice(0, 12) : '提交失败',
        icon: 'none'
      })
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
        {avatarUrl ? (
          <Image className='avatar-image' src={avatarUrl} mode='aspectFill' />
        ) : (
          <View className='avatar-mark'>
            <Text>{isLoggedIn ? '我' : '登'}</Text>
          </View>
        )}
        <View className='user-copy'>
          <Text className='user-name'>{user?.nickname || (isLoggedIn ? '微信用户' : '未登录')}</Text>
          <Text className='user-desc'>
            {isLoggedIn ? '已登录，可查看今日使用次数' : '登录后查看头像、昵称和使用次数'}
          </Text>
        </View>
        <Button className='login-action' hoverClass='login-action-hover' onClick={handleLogin}>
          {isLoggedIn ? '刷新' : '微信登录'}
        </Button>
      </View>

      <View className='usage-card'>
        <View className='usage-item'>
          <Text className='usage-number'>{quota ? quota.remaining : '-'}</Text>
          <Text className='usage-label'>今日剩余</Text>
        </View>
        <View className='usage-divider' />
        <View className='usage-item'>
          <Text className='usage-number'>{quota ? quota.used : '-'}</Text>
          <Text className='usage-label'>今日已用</Text>
        </View>
        <View className='usage-divider' />
        <View className='usage-item'>
          <Text className='usage-number'>{quota ? quota.total : '-'}</Text>
          <Text className='usage-label'>总次数</Text>
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

      <Text className='profile-footer'>© 2026 图片去水印与 MD5 工具</Text>

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
      <WeChatLoginDialog />
    </View>
  )
}
