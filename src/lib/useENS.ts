/**
 * 
 * Provides ENS resolution, avatar fetching, and validation
 * for a more creative ENS integration.
 */

import { useEnsName, useEnsAvatar, useEnsAddress } from 'wagmi';
import { mainnet } from 'wagmi/chains';
import { normalize } from 'viem/ens';

export interface ENSProfile {
  name: string | null;
  avatar: string | null;
  address: string | null;
  isLoading: boolean;
  isValid: boolean;
}

/**
 * Hook to get ENS profile from an address
 */
export function useENSProfile(address: string | undefined): ENSProfile {
  const { data: name, isLoading: nameLoading } = useEnsName({
    address: address as `0x${string}`,
    chainId: mainnet.id,
  });

  const { data: avatar, isLoading: avatarLoading } = useEnsAvatar({
    name: name ?? undefined,
    chainId: mainnet.id,
  });

  return {
    name: name ?? null,
    avatar: avatar ?? null,
    address: address ?? null,
    isLoading: nameLoading || avatarLoading,
    isValid: !!name,
  };
}

/**
 * Hook to resolve ENS name to address
 */
export function useResolveENS(input: string | undefined): {
  resolvedAddress: string | null;
  isENS: boolean;
  isLoading: boolean;
  isValid: boolean;
  displayName: string;
} {
  const isENS = input?.endsWith('.eth') ?? false;
  
  const { data: resolvedAddress, isLoading } = useEnsAddress({
    name: isENS ? input : undefined,
    chainId: mainnet.id,
  });

  // Get avatar for the resolved address (useful for displaying profile pics)
  const { data: _avatar } = useEnsAvatar({
    name: isENS ? input : undefined,
    chainId: mainnet.id,
  });

  return {
    resolvedAddress: isENS ? (resolvedAddress ?? null) : (input ?? null),
    isENS,
    isLoading: isENS ? isLoading : false,
    isValid: isENS ? !!resolvedAddress : isValidAddress(input),
    displayName: isENS ? (input ?? '') : formatAddress(input),
  };
}

/**
 * Validate if input is a valid ENS name
 */
export function isValidENS(input: string | undefined): boolean {
  if (!input) return false;
  try {
    // Check basic format
    if (!input.endsWith('.eth')) return false;
    if (input.length <= 4) return false;
    
    // Try to normalize (will throw if invalid)
    normalize(input);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate if input is a valid Ethereum address
 */
export function isValidAddress(input: string | undefined): boolean {
  if (!input) return false;
  return /^0x[a-fA-F0-9]{40}$/.test(input);
}

/**
 * Check if input is a valid recipient (address or ENS)
 */
export function isValidRecipient(input: string | undefined): boolean {
  if (!input) return false;
  return isValidAddress(input) || isValidENS(input);
}

/**
 * Format address for display
 */
export function formatAddress(address: string | undefined): string {
  if (!address) return '';
  if (address.endsWith('.eth')) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Generate a gradient from an address for avatar fallback
 */
export function generateAddressGradient(address: string): string {
  if (!address) return 'from-gray-400 to-gray-500';
  
  // Use address bytes to generate colors
  const hash = address.toLowerCase().replace('0x', '');
  const colors = [
    ['from-indigo-400', 'to-purple-500'],
    ['from-pink-400', 'to-rose-500'],
    ['from-cyan-400', 'to-blue-500'],
    ['from-emerald-400', 'to-teal-500'],
    ['from-amber-400', 'to-orange-500'],
    ['from-violet-400', 'to-fuchsia-500'],
  ];
  
  const index = parseInt(hash.slice(0, 8), 16) % colors.length;
  return `${colors[index][0]} ${colors[index][1]}`;
}

/**
 * Get initials from ENS name or address
 */
export function getInitials(input: string | undefined): string {
  if (!input) return '??';
  
  if (input.endsWith('.eth')) {
    // Get first 2 chars of ENS name (before .eth)
    const name = input.replace('.eth', '');
    return name.slice(0, 2).toUpperCase();
  }
  
  // For addresses, use first 2 hex chars after 0x
  return input.slice(2, 4).toUpperCase();
}
