/**
 * Notification Utilities
 * 
 * Browser notifications for split payments and payment requests.
 * Uses the Web Notifications API with graceful fallbacks.
 * 
 * NOTE: Web Notifications are LOCAL to the browser that enabled them.
 * To notify OTHER users, you need to share links via messaging apps.
 */

// Check if notifications are supported
export function isNotificationSupported(): boolean {
  return 'Notification' in window;
}

// Request notification permission
export async function requestNotificationPermission(): Promise<boolean> {
  if (!isNotificationSupported()) return false;
  
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  
  const permission = await Notification.requestPermission();
  return permission === 'granted';
}

// Check if we have permission
export function hasNotificationPermission(): boolean {
  if (!isNotificationSupported()) return false;
  return Notification.permission === 'granted';
}

// Show a browser notification (appears in OS notification center)
export function showNotification(
  title: string, 
  options?: NotificationOptions & { onClick?: () => void }
): Notification | null {
  if (!hasNotificationPermission()) return null;
  
  const notification = new Notification(title, {
    icon: '/vite.svg', // Use app icon
    badge: '/vite.svg',
    ...options,
  });
  
  if (options?.onClick) {
    notification.onclick = () => {
      options.onClick?.();
      window.focus();
      notification.close();
    };
  }
  
  // Auto close after 5 seconds
  setTimeout(() => notification.close(), 5000);
  
  return notification;
}

// In-app toast notification (doesn't require permission)
type ToastType = 'success' | 'info' | 'warning' | 'error';

export function showToast(message: string, type: ToastType = 'info'): void {
  // Create toast element
  const toast = document.createElement('div');
  const colors = {
    success: 'bg-emerald-500',
    info: 'bg-indigo-500',
    warning: 'bg-amber-500',
    error: 'bg-red-500'
  };
  const icons = {
    success: '✓',
    info: 'ℹ',
    warning: '⚠',
    error: '✕'
  };
  
  toast.className = `fixed bottom-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-white ${colors[type]} transform translate-y-full opacity-0 transition-all duration-300`;
  toast.innerHTML = `
    <span class="text-lg">${icons[type]}</span>
    <span class="text-sm font-medium">${message}</span>
  `;
  
  document.body.appendChild(toast);
  
  // Animate in
  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-full', 'opacity-0');
  });
  
  // Remove after 3 seconds
  setTimeout(() => {
    toast.classList.add('translate-y-full', 'opacity-0');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Generate share message for different platforms
export function generateShareMessage(data: {
  splitId: string;
  amount: number;
  description?: string;
  participantShare?: number;
}): { text: string; url: string } {
  const url = `${window.location.origin}/split/${data.splitId}`;
  const shareAmount = data.participantShare || data.amount;
  const text = `💸 You're invited to a split payment!\n\nAmount: $${shareAmount.toFixed(2)} USDC${data.description ? `\nFor: ${data.description}` : ''}\n\nPay your share here:`;
  
  return { text, url };
}

// Share platform types
export type SharePlatform = 'whatsapp' | 'telegram' | 'discord' | 'twitter' | 'email' | 'sms' | 'copy';

export interface ShareOption {
  id: SharePlatform;
  name: string;
  icon: string;
  color: string;
  bgColor: string;
}

// Available share platforms
export const SHARE_PLATFORMS: ShareOption[] = [
  { id: 'whatsapp', name: 'WhatsApp', icon: '💬', color: 'text-white', bgColor: 'bg-green-500 hover:bg-green-600' },
  { id: 'telegram', name: 'Telegram', icon: '✈️', color: 'text-white', bgColor: 'bg-blue-500 hover:bg-blue-600' },
  { id: 'discord', name: 'Discord', icon: '🎮', color: 'text-white', bgColor: 'bg-indigo-500 hover:bg-indigo-600' },
  { id: 'twitter', name: 'X/Twitter', icon: '𝕏', color: 'text-white', bgColor: 'bg-black hover:bg-gray-800' },
  { id: 'email', name: 'Email', icon: '📧', color: 'text-white', bgColor: 'bg-gray-600 hover:bg-gray-700' },
  { id: 'sms', name: 'SMS', icon: '📱', color: 'text-white', bgColor: 'bg-emerald-500 hover:bg-emerald-600' },
];

// Share via specific platform
export function shareViaPlatform(platform: SharePlatform, data: Parameters<typeof generateShareMessage>[0]): void {
  const { text, url } = generateShareMessage(data);
  const fullText = `${text}\n${url}`;
  
  switch (platform) {
    case 'whatsapp':
      window.open(`https://wa.me/?text=${encodeURIComponent(fullText)}`, '_blank');
      break;
    case 'telegram':
      window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, '_blank');
      break;
    case 'discord':
      // Discord doesn't have a direct share URL, so we copy and show instructions
      navigator.clipboard.writeText(fullText);
      showToast('Copied! Paste in Discord to share', 'success');
      break;
    case 'twitter':
      const tweetText = `Just created a split payment on @ZapPayments! 💸`;
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(url)}`, '_blank');
      break;
    case 'email':
      const subject = data.description ? `Split Payment: ${data.description}` : 'Split Payment Request';
      const body = `${text}\n\n${url}`;
      window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
      break;
    case 'sms':
      // SMS deep link (works on mobile)
      window.open(`sms:?body=${encodeURIComponent(fullText)}`, '_blank');
      break;
    case 'copy':
      navigator.clipboard.writeText(url);
      showToast('Link copied to clipboard!', 'success');
      break;
  }
}

// Share via WhatsApp (legacy, kept for backwards compatibility)
export function shareViaWhatsApp(data: Parameters<typeof generateShareMessage>[0]): void {
  shareViaPlatform('whatsapp', data);
}

// Share via Telegram (legacy, kept for backwards compatibility)
export function shareViaTelegram(data: Parameters<typeof generateShareMessage>[0]): void {
  shareViaPlatform('telegram', data);
}

// Share via Twitter/X (legacy, kept for backwards compatibility)
export function shareViaTwitter(data: Parameters<typeof generateShareMessage>[0]): void {
  shareViaPlatform('twitter', data);
}

// Copy share link with toast feedback
export function copyShareLink(splitId: string): void {
  const url = `${window.location.origin}/split/${splitId}`;
  navigator.clipboard.writeText(url);
  showToast('Link copied! Share it with participants', 'success');
}

// Split payment notification types
export interface SplitNotificationData {
  splitId: string;
  amount: number;
  yourShare: number;
  description?: string;
  creatorENS?: string;
  creatorAddress: string;
}

// Show notification for new split payment request (local browser notification)
export function notifySplitCreated(data: SplitNotificationData): void {
  const creator = data.creatorENS || `${data.creatorAddress.slice(0, 6)}...${data.creatorAddress.slice(-4)}`;
  
  showNotification(`💸 New Split Payment Request`, {
    body: `${creator} invited you to split $${data.amount.toFixed(2)}${data.description ? ` for "${data.description}"` : ''}\nYour share: $${data.yourShare.toFixed(2)}`,
    tag: `split-${data.splitId}`,
    requireInteraction: true,
    onClick: () => {
      window.location.href = `/split/${data.splitId}`;
    },
  });
  
  // Also show a toast for immediate feedback
  showToast(`Split created! Share the link with participants.`, 'success');
}

// Show notification when someone pays their share
export function notifySplitPayment(data: {
  splitId: string;
  payerENS?: string;
  payerAddress: string;
  amount: number;
  paidCount: number;
  totalParticipants: number;
}): void {
  const payer = data.payerENS || `${data.payerAddress.slice(0, 6)}...${data.payerAddress.slice(-4)}`;
  
  showNotification(`✅ Split Payment Received`, {
    body: `${payer} paid $${data.amount.toFixed(2)}\n${data.paidCount}/${data.totalParticipants} participants paid`,
    tag: `split-payment-${data.splitId}-${data.paidCount}`,
  });
}

// Show notification when split is fully paid
export function notifySplitComplete(data: {
  splitId: string;
  totalAmount: number;
  description?: string;
}): void {
  showNotification(`🎉 Split Complete!`, {
    body: `All participants paid! Total: $${data.totalAmount.toFixed(2)}${data.description ? ` for "${data.description}"` : ''}`,
    tag: `split-complete-${data.splitId}`,
  });
}

// Send reminder notification to unpaid participants
export function notifySplitReminder(data: {
  splitId: string;
  amount: number;
  yourShare: number;
  description?: string;
  unpaidCount: number;
  totalParticipants: number;
}): void {
  showNotification(`⏰ Split Payment Reminder`, {
    body: `${data.unpaidCount} of ${data.totalParticipants} haven't paid yet${data.description ? ` for "${data.description}"` : ''}\nTotal: $${data.amount.toFixed(2)}`,
    tag: `split-reminder-${data.splitId}`,
    requireInteraction: true,
    onClick: () => {
      window.location.href = `/split/${data.splitId}`;
    },
  });
}

// Show notification for regular payment received
export function notifyPaymentReceived(data: {
  intentId: string;
  amount: number;
  payerENS?: string;
  payerAddress: string;
  txHash: string;
}): void {
  const payer = data.payerENS || `${data.payerAddress.slice(0, 6)}...${data.payerAddress.slice(-4)}`;
  
  showNotification(`💰 Payment Received!`, {
    body: `${payer} sent you $${data.amount.toFixed(2)} USDC`,
    tag: `payment-${data.intentId}`,
    onClick: () => {
      window.open(`https://polygonscan.com/tx/${data.txHash}`, '_blank');
    },
  });
}

// Notification settings storage
const NOTIFICATION_SETTINGS_KEY = 'zap-notification-settings';

export interface NotificationSettings {
  enabled: boolean;
  splitInvites: boolean;
  splitPayments: boolean;
  paymentReceived: boolean;
}

const defaultSettings: NotificationSettings = {
  enabled: true,
  splitInvites: true,
  splitPayments: true,
  paymentReceived: true,
};

export function getNotificationSettings(): NotificationSettings {
  try {
    const saved = localStorage.getItem(NOTIFICATION_SETTINGS_KEY);
    return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
  } catch {
    return defaultSettings;
  }
}

export function saveNotificationSettings(settings: NotificationSettings): void {
  localStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(settings));
}
