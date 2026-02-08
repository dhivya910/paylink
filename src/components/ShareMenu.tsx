import { useState, useRef, useEffect } from 'react'
import { Share2, X } from 'lucide-react'
import { SHARE_PLATFORMS, shareViaPlatform, type SharePlatform } from '../lib/notifications'

interface ShareMenuProps {
  splitId: string
  amount: number
  description?: string
  buttonClassName?: string
  buttonText?: string
  showButtonText?: boolean
}

export default function ShareMenu({ 
  splitId, 
  amount, 
  description,
  buttonClassName = '',
  buttonText = 'Share',
  showButtonText = true
}: ShareMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Close on escape
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false)
    }
    
    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  const handleShare = (platform: SharePlatform) => {
    shareViaPlatform(platform, { splitId, amount, description })
    setIsOpen(false)
  }

  return (
    <div className="relative" ref={menuRef}>
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={buttonClassName || 'flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors'}
      >
        <Share2 className="w-4 h-4" />
        {showButtonText && <span className="text-sm font-medium">{buttonText}</span>}
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <>
          {/* Backdrop for mobile */}
          <div className="fixed inset-0 bg-black/20 dark:bg-black/40 z-40 sm:hidden" onClick={() => setIsOpen(false)} />
          
          {/* Menu */}
          <div className="absolute right-0 mt-2 w-64 rounded-xl bg-white dark:bg-gray-800 shadow-xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
              <span className="text-sm font-semibold text-gray-900 dark:text-white">Share via</span>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {/* Share options */}
            <div className="p-2">
              <div className="grid grid-cols-3 gap-2">
                {SHARE_PLATFORMS.map((platform) => (
                  <button
                    key={platform.id}
                    onClick={() => handleShare(platform.id)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-lg ${platform.bgColor} transition-all hover:scale-105 active:scale-95`}
                  >
                    <span className="text-xl">{platform.icon}</span>
                    <span className={`text-xs font-medium ${platform.color}`}>{platform.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// Compact version for inline use
export function ShareButton({ 
  splitId, 
  amount, 
  description,
  className = ''
}: Omit<ShareMenuProps, 'buttonClassName' | 'buttonText' | 'showButtonText'> & { className?: string }) {
  return (
    <ShareMenu
      splitId={splitId}
      amount={amount}
      description={description}
      buttonClassName={className || 'p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors'}
      showButtonText={false}
    />
  )
}

// Named export for convenience
export { ShareMenu }
