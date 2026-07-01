import { PropsWithChildren } from 'react'
import { useLaunch } from '@tarojs/taro'
import { ensureLoggedIn } from '@/services/auth'
import './app.css'

function App({ children }: PropsWithChildren) {
  useLaunch(() => {
    console.log('Watermark assistant launched.')
    ensureLoggedIn().catch(() => {
      console.warn('Login sync failed.')
    })
  })

  return children
}

export default App
