import { useEffect } from 'react'
import Taro, {
  useDidShow,
  useShareAppMessage,
  useShareTimeline
} from '@tarojs/taro'

const DEFAULT_SHARE_TITLE = '花果山去水印小栈'
const DEFAULT_SHARE_PATH = '/pages/index/index'
const DEFAULT_SHARE_QUERY = 'from=share'

interface PageShareOptions {
  title?: string
  path?: string
  query?: string
}

function normalizePath(path?: string, query = DEFAULT_SHARE_QUERY) {
  const basePath = path || DEFAULT_SHARE_PATH
  if (basePath.includes('?')) {
    return basePath
  }
  return `${basePath}?${query}`
}

export function usePageShare(options: PageShareOptions = {}) {
  const title = options.title || DEFAULT_SHARE_TITLE
  const query = options.query || DEFAULT_SHARE_QUERY
  const path = normalizePath(options.path, query)

  useDidShow(() => {
    Taro.showShareMenu({
      withShareTicket: true,
      showShareItems: ['shareAppMessage', 'shareTimeline']
    }).catch(() => {
      // Some old clients may not support every share menu API.
    })
  })

  useShareAppMessage(() => ({
    title,
    path
  }))

  useShareTimeline(() => ({
    title,
    query
  }))

  useEffect(() => {
    const shareApi = Taro as typeof Taro & {
      onCopyUrl?: typeof Taro.onCopyUrl
      offCopyUrl?: typeof Taro.offCopyUrl
    }

    if (typeof shareApi.onCopyUrl !== 'function' || typeof shareApi.offCopyUrl !== 'function') {
      return undefined
    }

    const copyUrlHandler = (() => ({
      query
    })) as unknown as Parameters<typeof Taro.onCopyUrl>[0]

    shareApi.onCopyUrl(copyUrlHandler)

    return () => {
      shareApi.offCopyUrl?.(copyUrlHandler)
    }
  }, [query])
}
