import { useEffect, useRef, useState } from 'react'
import Taro from '@tarojs/taro'
import { Button, Image, Input, Text, View } from '@tarojs/components'
import { subscribeLoginPrompt, type WeChatProfileDraft } from '@/services/loginBridge'
import './index.css'

interface PendingPrompt {
  reason?: string
  resolve: (profile: WeChatProfileDraft) => void
  reject: (error: Error) => void
}

export default function WeChatLoginDialog() {
  const pendingRef = useRef<PendingPrompt | null>(null)
  const [visible, setVisible] = useState(false)
  const [reason, setReason] = useState('')
  const [nickname, setNickname] = useState('')
  const [avatarPath, setAvatarPath] = useState('')
  const [manualVisible, setManualVisible] = useState(false)

  useEffect(() => {
    return subscribeLoginPrompt((payload) => {
      pendingRef.current = payload
      setReason(payload.reason || '登录后才能继续使用本功能，并同步今日免费次数。')
      setNickname('')
      setAvatarPath('')
      setManualVisible(false)
      setVisible(true)
    })
  }, [])

  const closeWithError = () => {
    const pending = pendingRef.current
    pendingRef.current = null
    setVisible(false)
    pending?.reject(new Error('用户取消登录'))
  }

  const resolveProfile = (profile: WeChatProfileDraft) => {
    const pending = pendingRef.current
    pendingRef.current = null
    setVisible(false)
    pending?.resolve(profile)
  }

  const authorizeWithWeChat = async () => {
    try {
      const profile = await Taro.getUserProfile({
        desc: '用于登录后展示头像昵称并记录操作日志'
      })
      const userInfo = profile.userInfo
      if (!userInfo?.nickName || !userInfo?.avatarUrl || userInfo.nickName === '微信用户') {
        setManualVisible(true)
        Taro.showToast({ title: '请手动选择头像昵称', icon: 'none' })
        return
      }

      resolveProfile({
        nickname: userInfo.nickName,
        avatar_url: userInfo.avatarUrl
      })
    } catch {
      setManualVisible(true)
      Taro.showToast({ title: '请手动选择头像昵称', icon: 'none' })
    }
  }

  const confirm = () => {
    const name = nickname.trim()
    if (!avatarPath) {
      Taro.showToast({ title: '请先选择微信头像', icon: 'none' })
      return
    }
    if (!name) {
      Taro.showToast({ title: '请先填写微信昵称', icon: 'none' })
      return
    }

    resolveProfile({ nickname: name, avatar_path: avatarPath })
  }

  if (!visible) {
    return null
  }

  return (
    <View className='wechat-login-mask'>
      <View className='wechat-login-panel'>
        <Text className='wechat-login-title'>微信登录</Text>
        <Text className='wechat-login-desc'>{reason}</Text>

        <Button className='wechat-auth-button' hoverClass='wechat-login-hover' onClick={authorizeWithWeChat}>
          微信授权登录
        </Button>

        <Button className='manual-toggle' hoverClass='wechat-login-hover' onClick={() => setManualVisible(true)}>
          手动选择头像昵称
        </Button>

        {manualVisible ? (
          <>
            <Button
              className='avatar-picker'
              openType='chooseAvatar'
              hoverClass='avatar-picker-hover'
              onChooseAvatar={(event) => setAvatarPath(event.detail.avatarUrl)}
            >
              {avatarPath ? (
                <Image className='avatar-preview' src={avatarPath} mode='aspectFill' />
              ) : (
                <Text className='avatar-placeholder'>选头像</Text>
              )}
            </Button>

            <Input
              className='nickname-input'
              type='nickname'
              value={nickname}
              placeholder='请输入微信昵称'
              maxlength={40}
              onInput={(event) => setNickname(event.detail.value)}
            />
          </>
        ) : null}

        <View className='wechat-login-actions'>
          <Button className='wechat-login-cancel' hoverClass='wechat-login-hover' onClick={closeWithError}>
            取消
          </Button>
          {manualVisible ? (
            <Button className='wechat-login-confirm' hoverClass='wechat-login-hover' onClick={confirm}>
              确认登录
            </Button>
          ) : null}
        </View>
      </View>
    </View>
  )
}
