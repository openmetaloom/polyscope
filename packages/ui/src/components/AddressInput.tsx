import { useState, useCallback } from 'react';
import { Search, Loader2, CheckCircle2, AlertCircle, Wallet } from 'lucide-react';
import { useEnsResolution } from '@/hooks/useEns';

interface AddressInputProps {
  onAddressLoaded: (address: string, ensName?: string) => void;
  compact?: boolean;
}

export default function AddressInput({ onAddressLoaded, compact = false }: AddressInputProps) {
  const [input, setInput] = useState('');
  const { resolve, validateAddress, resolving, result } = useEnsResolution();
  const [isValidInput, setIsValidInput] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInput(value);
    setIsValidInput(validateAddress(value));
  };

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    
    if (!input.trim()) return;
    
    const resolution = await resolve(input.trim());
    
    if (resolution.isValid && resolution.address) {
      onAddressLoaded(resolution.address, resolution.ensName);
    }
  }, [input, resolve, onAddressLoaded]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  // Example addresses for quick testing
  const examples = [
    { label: 'vitalik.eth', value: 'vitalik.eth' },
    { label: 'nick.eth', value: 'nick.eth' },
    { label: 'tomismeta.eth', value: 'tomismeta.eth' },
  ];

  if (compact) {
    return (
      <form onSubmit={handleSubmit} className="w-full">
        <div className="relative flex items-center">
          <Wallet className="absolute left-3 w-4 h-4 text-muted" />
          <input
            type="text"
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Address or ENS..."
            className="w-full pl-10 pr-20 py-2 bg-surface border border-surface-border rounded-lg
                       text-sm text-text-primary placeholder:text-muted
                       focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary
                       transition-all duration-200"
          />
          <button
            type="submit"
            disabled={!isValidInput || resolving}
            className="absolute right-1.5 px-3 py-1 bg-primary text-black text-sm font-medium 
                       rounded-md hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed
                       transition-all duration-200 flex items-center gap-1"
          >
            {resolving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Search className="w-3.5 h-3.5" />
            )}
            Load
          </button>
        </div>
        {result && !result.isValid && (
          <div className="flex items-center gap-1.5 mt-1.5 text-xs text-danger">
            <AlertCircle className="w-3 h-3" />
            {result.error}
          </div>
        )}
      </form>
    );
  }

  return (
    <div className="w-full animate-slide-up">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Wallet className="h-5 w-5 text-muted" />
          </div>
          <input
            type="text"
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Enter Ethereum address or ENS name (e.g., vitalik.eth)"
            className={`
              block w-full pl-12 pr-32 py-4 
              bg-surface border-2 rounded-xl
              text-text-primary placeholder:text-muted text-base
              focus:outline-none focus:ring-2 focus:ring-primary/30
              transition-all duration-200
              ${result && !result.isValid ? 'border-danger' : isValidInput ? 'border-primary/50' : 'border-surface-border'}
            `}
          />
          <div className="absolute inset-y-0 right-0 pr-2 flex items-center">
            <button
              type="submit"
              disabled={!isValidInput || resolving}
              className="
                flex items-center gap-2 px-6 py-2.5
                bg-primary text-black font-semibold
                rounded-lg hover:bg-primary-hover 
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-all duration-200 active:scale-[0.98]
              "
            >
              {resolving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Resolving...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>Load</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Validation feedback */}
        {result && (
          <div className={`
            flex items-center gap-2 text-sm animate-fade-in
            ${result.isValid ? 'text-success' : 'text-danger'}
          `}>
            {result.isValid ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <AlertCircle className="w-4 h-4" />
            )}
            {result.isValid ? (
              <span>
                Resolved to <code className="bg-surface px-1.5 py-0.5 rounded text-xs">{result.address}</code>
                {result.ensName && ` (${result.ensName})`}
              </span>
            ) : (
              <span>{result.error}</span>
            )}
          </div>
        )}

        {/* Quick examples */}
        <div className="flex flex-wrap items-center gap-2 text-sm text-text-secondary">
          <span>Try:</span>
          {examples.map((example) => (
            <button
              key={example.value}
              type="button"
              onClick={() => {
                setInput(example.value);
                setIsValidInput(true);
              }}
              className="px-3 py-1 bg-surface-hover hover:bg-surface border border-surface-border 
                         rounded-full text-xs transition-colors duration-200"
            >
              {example.label}
            </button>
          ))}
        </div>
      </form>
    </div>
  );
}
