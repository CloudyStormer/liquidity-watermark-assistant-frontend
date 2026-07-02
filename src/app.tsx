import { PropsWithChildren } from 'react'
import { useLaunch } from '@tarojs/taro'
import WeChatLoginDialog from '@/components/WeChatLoginDialog'
import './app.css'

function App({ children }: PropsWithChildren) {
  useLaunch(() => {
    console.log('Watermark assistant launched.')
  })

  return (
    <>
      {children}
      <WeChatLoginDialog />
    </>
  )
}

export default App
