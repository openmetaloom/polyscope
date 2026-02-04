import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import type { EnsResolutionResult } from '@/types';

// Use public Ethereum RPC for ENS resolution
const PROVIDER_URL = 'https://cloudflare-eth.com';

export function useEnsResolution() {
  const [resolving, setResolving] = useState(false);
  const [result, setResult] = useState<EnsResolutionResult | null>(null);

  const resolve = useCallback(async (input: string): Promise<EnsResolutionResult> => {
    setResolving(true);
    const trimmedInput: string = input.trim();
    
    try {
      // Check if it's already an address
      if (ethers.isAddress(trimmedInput)) {
        const normalizedAddress = ethers.getAddress(trimmedInput);
        
        // Try to reverse resolve ENS
        try {
          const provider = new ethers.JsonRpcProvider(PROVIDER_URL);
          const ensName = await provider.lookupAddress(normalizedAddress);
          
          const result: EnsResolutionResult = {
            address: normalizedAddress,
            ensName: ensName || undefined,
            isValid: true,
          };
          setResult(result);
          return result;
        } catch {
          const result: EnsResolutionResult = {
            address: normalizedAddress,
            isValid: true,
          };
          setResult(result);
          return result;
        }
      }
      
      // Check if it's an ENS name
      if ((trimmedInput as string).toLowerCase().endsWith('.eth')) {
        const provider = new ethers.JsonRpcProvider(PROVIDER_URL);
        const address = await provider.resolveName(trimmedInput);
        
        if (address) {
          const result: EnsResolutionResult = {
            address: ethers.getAddress(address),
            ensName: trimmedInput,
            isValid: true,
          };
          setResult(result);
          return result;
        } else {
          const result: EnsResolutionResult = {
            address: '',
            ensName: trimmedInput,
            isValid: false,
            error: 'ENS name not found',
          };
          setResult(result);
          return result;
        }
      }
      
      // Invalid input
      const result: EnsResolutionResult = {
        address: '',
        isValid: false,
        error: 'Invalid Ethereum address or ENS name',
      };
      setResult(result);
      return result;
      
    } catch (error) {
      const result: EnsResolutionResult = {
        address: '',
        isValid: false,
        error: error instanceof Error ? error.message : 'Failed to resolve',
      };
      setResult(result);
      return result;
    } finally {
      setResolving(false);
    }
  }, []);

  const validateAddress = useCallback((input: string): boolean => {
    const trimmedInput: string = input.trim();
    if (ethers.isAddress(trimmedInput)) return true;
    if (trimmedInput.toLowerCase().endsWith('.eth')) return true;
    return false;
  }, []);

  return { resolve, validateAddress, resolving, result };
}

export function formatAddress(address: string, ensName?: string): string {
  if (ensName) return ensName;
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
