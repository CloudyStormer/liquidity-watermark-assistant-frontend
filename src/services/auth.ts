import Taro from '@tarojs/taro'
import { WEAPP_LOGIN_PATH } from '@/config/api'
import { requestJson } from './request'

const OPENID_STORAGE_KEY = 'wm_openid'
const USER_STORAGE_KEY = 'wm_user'

export interface LoginResponse {
  openid: string
  nickname?: string
  avatar_url?: string
}

interface LoginOptions {
  reason?: string
  needProfile?: boolean
}

interface WeChatProfile {
  nickname?: string
  avatar_url?: string
}

interface UserProfileResponse {
  user: LoginResponse
}

function hashCode(input: string) {
  let hash = 0
  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash << 5) - hash + input.charCodeAt(index)) | 0
  }

  return Math.abs(hash).toString(36)
}

export function getStoredOpenid() {
  try {
    return Taro.getStorageSync<string>(OPENID_STORAGE_KEY) || ''
  } catch {
    return ''
  }
}

export function getStoredUser() {
  try {
    return Taro.getStorageSync<LoginResponse>(USER_STORAGE_KEY) || null
  } catch {
    return null
  }
}

function storeUser(user: LoginResponse) {
  Taro.setStorageSync(OPENID_STORAGE_KEY, user.openid)
  Taro.setStorageSync(USER_STORAGE_KEY, user)
}

function clearStoredUser() {
  Taro.removeStorageSync(OPENID_STORAGE_KEY)
  Taro.removeStorageSync(USER_STORAGE_KEY)
}

function canUseDevOpenid() {
  return process.env.NODE_ENV === 'development'
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message
  }

  const payload = error as { errMsg?: string; message?: string }
  return payload?.errMsg || payload?.message || '未知错误'
}

async function confirmLogin(reason?: string) {
  const result = await Taro.showModal({
    title: '需要登录',
    content: reason || '登录后才能继续使用本功能，并同步今日免费次数。',
    confirmText: '微信登录',
    cancelText: '取消'
  })

  if (!result.confirm) {
    throw new Error('用户取消登录')
  }
}

async function readWeChatProfile(): Promise<WeChatProfile> {
  try {
    const profile = await Taro.getUserProfile({
      desc: '用于展示头像昵称和同步使用次数'
    })
    const userInfo = profile.userInfo
    if (!userInfo?.nickName || !userInfo?.avatarUrl) {
      throw new Error('微信未返回头像昵称')
    }
    return {
      nickname: userInfo.nickName,
      avatar_url: userInfo.avatarUrl
    }
  } catch (error) {
    throw new Error(`需要授权微信头像昵称后才能继续：${getErrorMessage(error)}`)
  }
}

async function exchangeCodeForOpenid(code: string, profile?: WeChatProfile) {
  const response = await requestJson<LoginResponse>(WEAPP_LOGIN_PATH, {
    method: 'POST',
    data: {
      code,
      nickname: profile?.nickname || '小程序用户',
      avatar_url: profile?.avatar_url
    }
  })

  if (!response?.openid) {
    throw new Error('openid missing')
  }

  storeUser(response)
  return response.openid
}

async function createDevUser(openid: string, profile?: WeChatProfile) {
  const user = await requestJson<LoginResponse>('/users/login', {
    method: 'POST',
    data: {
      openid,
      nickname: profile?.nickname || '小程序用户',
      avatar_url: profile?.avatar_url
    }
  })

  storeUser(user)
  return user.openid
}

async function validateStoredUser(openid: string) {
  const profile = await requestJson<UserProfileResponse>(`/users/${encodeURIComponent(openid)}/profile`)
  storeUser(profile.user)
  return profile.user
}

async function getLoginCode() {
  try {
    const loginResult = await Taro.login()
    if (!loginResult.code) {
      throw new Error('微信未返回登录 code')
    }
    return loginResult.code
  } catch (error) {
    throw new Error(`微信登录失败：${getErrorMessage(error)}`)
  }
}

async function loginWithWeChatProfile(reason?: string) {
  await confirmLogin(reason)
  const profile = await readWeChatProfile()
  const code = await getLoginCode()

  try {
    return await exchangeCodeForOpenid(code, profile)
  } catch (error) {
    if (!canUseDevOpenid()) {
      throw new Error(`微信登录失败：${getErrorMessage(error)}`)
    }
    const devOpenid = `dev_openid_${hashCode(code)}`
    return createDevUser(devOpenid, profile)
  }
}

export async function ensureLoggedIn(options: LoginOptions = {}) {
  const storedOpenid = getStoredOpenid()
  const needsProfile = options.needProfile !== false
  if (storedOpenid) {
    const storedUser = getStoredUser()
    if (needsProfile && (!storedUser?.nickname || !storedUser?.avatar_url || storedUser.nickname === '小程序用户')) {
      return loginWithWeChatProfile(options.reason || '需要补充微信头像昵称后才能继续使用本功能。')
    }

    try {
      await validateStoredUser(storedOpenid)
    } catch {
      clearStoredUser()
      return loginWithWeChatProfile(options.reason || '登录状态已过期，请重新微信登录后继续。')
    }
    return storedOpenid
  }

  const openid = await loginWithWeChatProfile(options.reason)
  Taro.showToast({ title: '登录成功', icon: 'success' })
  return openid
}

export async function requireLoggedIn(reason?: string) {
  try {
    return await ensureLoggedIn({ reason, needProfile: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (message.includes('取消登录')) {
      throw error
    }

    Taro.showModal({
      title: '登录失败',
      content: message || '请确认微信登录可用后重试',
      showCancel: false
    })
    throw error
  }
}
