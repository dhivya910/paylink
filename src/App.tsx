import { Routes, Route, Link } from 'react-router-dom'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import LandingPage from './pages/LandingPage'
import CreatePage from './pages/CreatePage'
import PayPage from './pages/PayPage'
import SplitPage from './pages/SplitPage'
import SplitDetailPage from './pages/SplitDetailPage'
import { Zap, Sun, Moon} from 'lucide-react'
import { useEffect, useState } from 'react'

function ThemeToggle() {
  const [dark, setDark] = useState<boolean>(() => {
    const saved = localStorage.getItem('Zap-theme')
    return saved ? saved === 'dark' : true
  })

  useEffect(() => {
    const root = document.documentElement
    if (dark) root.classList.add('dark')
    else root.classList.remove('dark')
    localStorage.setItem('Zap-theme', dark ? 'dark' : 'light')
  }, [dark])

  return (
    <button
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      onClick={() => setDark(v => !v)}
      className="w-9 h-9 rounded-lg flex items-center justify-center
                 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100
                 hover:bg-gray-100 dark:hover:bg-gray-800
                 transition-colors duration-150"
    >
      {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  )
}

function App() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-950/80 backdrop-blur-sm">
        <div className="container py-3 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-gray-900 dark:text-white leading-tight">Zap</span>
              <span className="text-[10px] text-gray-500 leading-tight hidden sm:block">
                Cross-chain payments
              </span>
            </div>
          </Link>
          
          {/* Right side */}
          <div className="flex items-center gap-2">
            <ThemeToggle />
            
            <ConnectButton.Custom>
              {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
                const ready = mounted
                const connected = ready && account && chain

                return (
                  <div {...(!ready && { 'aria-hidden': true, style: { opacity: 0, pointerEvents: 'none', userSelect: 'none' } })}>
                    {(() => {
                      if (!connected) {
                        return (
                          <button 
                            onClick={openConnectModal} 
                            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700
                                     text-white text-sm font-medium transition-colors"
                          >
                            Connect
                          </button>
                        )
                      }

                      if (chain.unsupported) {
                        return (
                          <button 
                            onClick={openChainModal}
                            className="px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20
                                     text-red-600 dark:text-red-400 text-sm font-medium"
                          >
                            Wrong network
                          </button>
                        )
                      }

                      return (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={openChainModal}
                            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                          >
                            {chain.hasIcon && chain.iconUrl && (
                              <img src={chain.iconUrl} alt={chain.name} className="w-5 h-5 rounded-full" />
                            )}
                          </button>

                          <button
                            onClick={openAccountModal}
                            className="px-3 py-2 rounded-lg text-sm font-medium
                                     text-gray-700 dark:text-gray-300
                                     hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                          >
                            {account.displayName}
                          </button>
                        </div>
                      )
                    })()}
                  </div>
                )
              }}
            </ConnectButton.Custom>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="container relative flex-1">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/create" element={<CreatePage />} />
          <Route path="/pay/:intentId" element={<PayPage />} />
          <Route path="/split" element={<SplitPage />} />
          <Route path="/split/:splitId" element={<SplitDetailPage />} />
        </Routes>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
        <div className="container py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-sm text-gray-500">
              <div className="w-5 h-5 rounded bg-indigo-600 flex items-center justify-center">
                <Zap className="w-3 h-3 text-white" />
              </div>
              <span className="font-medium text-gray-700 dark:text-gray-300">Zap</span>
              <span className="text-gray-300 dark:text-gray-700">·</span>
              <span>Built for ETHGlobal HackMoney</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App
