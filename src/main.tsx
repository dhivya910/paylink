import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { BrowserRouter } from 'react-router-dom'
import { getDefaultConfig, RainbowKitProvider, lightTheme } from '@rainbow-me/rainbowkit'
import '@rainbow-me/rainbowkit/styles.css'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { sepolia } from 'wagmi/chains'

// Initialize LI.FI SDK on app load
import './lib/lifi'

const PROJECT_ID = (import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string) || 'f81fd3fc2904b6e2cccf591c774c0c9e'

const config = getDefaultConfig({
  appName: 'PayLink',
  projectId: PROJECT_ID,
  chains: [sepolia], // Testnet mode - Uniswap works on Sepolia
})
const queryClient = new QueryClient()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={lightTheme()}>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </StrictMode>,
)
