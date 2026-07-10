import { useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { Button, Image, Input, Text, Textarea, View } from '@tarojs/components'
import BottomNav from '@/components/BottomNav'
import WeChatLoginDialog from '@/components/WeChatLoginDialog'
import {
  fetchUserProfile,
  getStoredOpenid,
  getStoredUser,
  requireLoggedIn,
  type LoginResponse
} from '@/services/auth'
import { toApiUrl } from '@/services/mediaJobs'
import { getDailyQuota } from '@/services/quota'
import { submitFeedback, submitRating } from '@/services/userActions'
import type { DailyQuotaResponse, UserProfileResponse } from '@/types/media'
import { usePageShare } from '@/utils/share'
import './index.css'

interface MenuItem {
  id: string
  icon: string
  label: string
  value?: string
  content?: string
}

const APP_VERSION = '1.0.0'

function getAvatarUrl(user?: LoginResponse | null) {
  const avatarUrl = user?.avatar_url
  if (!avatarUrl) {
    return ''
  }
  return /^https?:\/\//i.test(avatarUrl) || avatarUrl.startsWith('/')
    ? toApiUrl(avatarUrl)
    : avatarUrl
}

export default function ProfilePage() {
  usePageShare({
    title: '花果山去水印小栈 - 图片去水印与视频 MD5 工具',
    path: '/pages/index/index',
    query: 'from=share&page=profile'
  })

  const [user, setUser] = useState<LoginResponse | null>(() => getStoredUser())
  const [profile, setProfile] = useState<UserProfileResponse | null>(null)
  const [quota, setQuota] = useState<DailyQuotaResponse | null>(null)
  const [modal, setModal] = useState<{ title: string; body: string } | null>(null)
  const [feedbackVisible, setFeedbackVisible] = useState(false)
  const [feedbackContent, setFeedbackContent] = useState('')
  const [feedbackContact, setFeedbackContact] = useState('')
  const [ratingVisible, setRatingVisible] = useState(false)
  const [ratingScore, setRatingScore] = useState(5)
  const [ratingComment, setRatingComment] = useState('')

  const isLoggedIn = Boolean(user?.openid || getStoredOpenid())
  const avatarUrl = getAvatarUrl(user)
  const latestScore = profile?.latest_rating_score || null

  const menuItems: MenuItem[] = [
    {
      id: 'feedback',
      icon: '反馈',
      label: '用户反馈'
    },
    {
      id: 'rate',
      icon: '评分',
      label: '给我们评分',
      value: latestScore ? `${latestScore} 分` : undefined
    },
    {
      id: 'privacy',
      icon: '隐私',
      label: '隐私协议',
      content:
        '隐私协议\n\n本应用仅为处理自有或已授权素材提供工具能力。上传素材仅用于本次处理和临时下载，请勿上传包含敏感隐私的信息。\n\n如有问题，请通过用户反馈提交。'
    },
    {
      id: 'terms',
      icon: '协议',
      label: '用户协议',
      content:
        '用户协议\n\n使用本工具即表示您同意：\n1. 仅处理本人拥有合法版权或授权的素材\n2. 不将处理结果用于任何侵权行为\n3. 不上传违法、侵权或侵犯隐私的内容\n\n违反上述条款产生的责任由用户自行承担。'
    },
    {
      id: 'version',
      icon: '版本',
      label: '版本信息',
      value: `v${APP_VERSION}`
    }
  ]

  const refreshProfile = async () => {
    const openid = getStoredOpenid()
    const storedUser = getStoredUser()
    setUser(storedUser)

    if (!openid) {
      setProfile(null)
      setQuota(null)
      return
    }

    try {
      const [nextProfile, nextQuota] = await Promise.all([
        fetchUserProfile(openid),
        getDailyQuota()
      ])
      setProfile(nextProfile)
      setQuota(nextQuota)
      setUser(nextProfile.user)
      setRatingScore(nextProfile.latest_rating_score || 5)
      setRatingComment(nextProfile.latest_rating_comment || '')
    } catch {
      setProfile(null)
      setQuota(null)
    }
  }

  useDidShow(() => {
    refreshProfile()
  })

  const handleLogin = async () => {
    try {
      await requireLoggedIn('登录后可查看微信头像、昵称和使用次数。')
      await refreshProfile()
    } catch {
      // 登录弹窗已经给出提示。
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
        // 用户取消登录。
      }
      return
    }

    if (item.id === 'rate') {
      try {
        await requireLoggedIn('登录后才能提交评分。')
        await refreshProfile()
        setRatingVisible(true)
      } catch {
        // 用户取消登录。
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
      await refreshProfile()
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
      await refreshProfile()
      Taro.showToast({ title: '评分已提交', icon: 'success' })
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
            {isLoggedIn ? '已登录，数据已同步到后端' : '登录后查看头像、昵称和使用次数'}
          </Text>
        </View>
        {!isLoggedIn ? (
          <Button className='login-action' hoverClass='login-action-hover' onClick={handleLogin}>
            微信登录
          </Button>
        ) : null}
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
          <Text className='usage-number'>{profile ? profile.usage_total : '-'}</Text>
          <Text className='usage-label'>使用总次数</Text>
        </View>
      </View>

      <View className='menu-card'>
        {menuItems.map((item, index) => (
          <Button
            key={item.id}
            className={`menu-row ${index < menuItems.length - 1 ? 'has-border' : ''}`}
            hoverClass={item.id === 'version' ? 'none' : 'menu-row-hover'}
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
            <Text className='rating-desc'>请选择 1-5 分，提交后会记录到当前微信用户。</Text>
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
            <Text className='score-copy'>{ratingScore} 分</Text>
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
