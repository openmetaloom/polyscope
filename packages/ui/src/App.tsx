import { useState } from 'react';
import { Search, Wallet, TrendingUp, Newspaper, Menu, X } from 'lucide-react';
import AddressInput from './components/AddressInput';
import PortfolioView from './components/PortfolioView';
import PositionsView from './components/PositionsView';
import MarketsView from './components/MarketsView';
import NewsView from './components/NewsView';

type Tab = 'portfolio' | 'positions' | 'markets' | 'news';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('portfolio');
  const [address, setAddress] = useState<string>('');
  const [ensName, setEnsName] = useState<string>('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleAddressLoaded = (addr: string, ens?: string) => {
    setAddress(addr);
    setEnsName(ens || '');
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'portfolio', label: 'Portfolio', icon: <Wallet className="w-4 h-4" /> },
    { id: 'positions', label: 'Positions', icon: <TrendingUp className="w-4 h-4" /> },
    { id: 'markets', label: 'Markets', icon: <Search className="w-4 h-4" /> },
    { id: 'news', label: 'News', icon: <Newspaper className="w-4 h-4" /> },
  ];

  const renderContent = () => {
    if (!address) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
            <Wallet className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-2xl font-semibold text-text-primary mb-2">
            Welcome to PolyScope
          </h2>
          <p className="text-text-secondary text-center max-w-md mb-8">
            Enter an Ethereum address or ENS name to view portfolio, positions, and market data.
          </p>
        </div>
      );
    }

    switch (activeTab) {
      case 'portfolio':
        return <PortfolioView address={address} />;
      case 'positions':
        return <PositionsView address={address} />;
      case 'markets':
        return <MarketsView />;
      case 'news':
        return <NewsView address={address} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background text-text-primary">
      {/* Header */}
      <header className="border-b border-surface-border bg-surface/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center">
                <span className="text-black font-bold text-sm">P</span>
              </div>
              <span className="font-semibold text-lg hidden sm:block">PolyScope</span>
            </div>

            {/* Address Input - Desktop */}
            <div className="hidden md:flex flex-1 max-w-xl mx-8">
              <AddressInput onAddressLoaded={handleAddressLoaded} compact />
            </div>

            {/* Address Display */}
            {address && (
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface border border-surface-border">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span className="text-sm text-text-secondary">
                  {ensName || `${address.slice(0, 6)}...${address.slice(-4)}`}
                </span>
              </div>
            )}

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-surface-hover transition-colors"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-surface-border p-4 space-y-4 animate-fade-in">
            <AddressInput onAddressLoaded={handleAddressLoaded} />
            {address && (
              <div className="flex items-center gap-2 text-sm text-text-secondary">
                <div className="w-2 h-2 rounded-full bg-primary" />
                {ensName || address}
              </div>
            )}
          </div>
        )}
      </header>

      {/* Navigation Tabs */}
      <nav className="border-b border-surface-border bg-surface/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-1 overflow-x-auto scrollbar-hide">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                disabled={!address && tab.id !== 'markets' && tab.id !== 'news'}
                className={`
                  flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap
                  transition-all duration-200 border-b-2
                  ${
                    activeTab === tab.id
                      ? 'border-primary text-primary'
                      : 'border-transparent text-text-secondary hover:text-text-primary hover:bg-surface-hover'
                  }
                  ${!address && tab.id !== 'markets' && tab.id !== 'news' ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Mobile Address Input */}
        <div className="md:hidden mb-6">
          <AddressInput onAddressLoaded={handleAddressLoaded} />
        </div>

        {/* Desktop Address Input when no address */}
        {!address && (
          <div className="hidden md:flex justify-center mb-8">
            <div className="w-full max-w-2xl">
              <AddressInput onAddressLoaded={handleAddressLoaded} />
            </div>
          </div>
        )}

        {renderContent()}
      </main>
    </div>
  );
}

export default App;
