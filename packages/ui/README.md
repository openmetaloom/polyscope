# PolyScope UI

A modern, minimalistic web UI for PolyScope analytics. Built with React 18, TypeScript, Tailwind CSS, and Vite.

![PolyScope](https://img.shields.io/badge/PolyScope-Analytics-green)
![React](https://img.shields.io/badge/React-18-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.0-cyan)

## Features

- **Address Input with ENS Resolution** - Enter any Ethereum address or ENS name (e.g., `vitalik.eth`)
- **Portfolio Dashboard** - View total value, chain breakdown, and token holdings
- **Positions Tab** - Track active positions with real-time price updates (30s polling)
- **Markets Tab** - Browse and search prediction markets with filtering
- **News Tab** - Latest news feed with trading signals
- **Market Detail Modal** - Full market information and price data
- **Real-time Updates** - Live position prices with visual indicators
- **Responsive Design** - Works on desktop, tablet, and mobile

## Design

- Dark theme (#0a0a0a background)
- Green accent (#00d084)
- Clean Inter typography
- Card-based layout with subtle borders
- Smooth animations and transitions

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

The UI will be available at `http://localhost:5173`

## Configuration

Create a `.env` file in the project root:

```env
# API Configuration
VITE_API_URL=http://localhost:3000/api/v1

# Optional: Custom RPC for ENS resolution (defaults to Cloudflare)
# VITE_RPC_URL=https://cloudflare-eth.com
```

## API Integration

The UI expects the following endpoints:

| Endpoint | Description |
|----------|-------------|
| `GET /portfolio/{address}` | Portfolio data including tokens and value |
| `GET /positions/{address}` | Active positions list |
| `GET /markets` | List all markets |
| `GET /markets/search?q={query}` | Search markets |
| `GET /prices/{tokenId}` | Get token price |
| `GET /news` | News feed |

## Test Addresses

Test with these example addresses:
- `0x1234567890123456789012345678901234567890`
- ENS Examples: `vitalik.eth`, `nick.eth`

## Project Structure

```
src/
├── components/
│   ├── AddressInput.tsx    # ENS resolution input
│   ├── PortfolioView.tsx   # Portfolio tab
│   ├── PositionsView.tsx   # Positions tab
│   ├── MarketsView.tsx     # Markets tab
│   ├── NewsView.tsx        # News tab
│   ├── MarketCard.tsx      # Market card component
│   └── PositionCard.tsx    # Position card component
├── hooks/
│   ├── useApi.ts           # API hooks
│   └── useEns.ts           # ENS resolution
├── types/
│   └── index.ts            # TypeScript types
├── App.tsx                 # Main app
├── main.tsx                # Entry point
└── index.css               # Global styles
```

## Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **Ethers.js v6** - ENS resolution
- **Axios** - HTTP client
- **Lucide React** - Icons
- **Recharts** - Charts

## ENS Resolution

The UI automatically detects ENS names (`.eth`) and resolves them to Ethereum addresses using the Cloudflare Ethereum gateway. Both the ENS name and resolved address are displayed in the UI.

## Real-time Updates

- Position prices refresh every 30 seconds
- Visual "Live" indicator shows when fresh data is available
- Manual refresh button for immediate updates

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## License

MIT