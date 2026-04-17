import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AppRoot } from './App'
import { PreloadBridgeError } from './components/PreloadBridgeError'

const rootElement = document.getElementById('root')!
const root = createRoot(rootElement)

if (typeof window.api === 'undefined') {
  root.render(<PreloadBridgeError />)
} else {
  root.render(
    <StrictMode>
      <AppRoot />
    </StrictMode>
  )
}
