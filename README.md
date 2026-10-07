# eKithab Audio Pipeline

Indic TTS Sync Engine - Converts eKithab text guides into synchronized, code-switched Indic audiobooks using Gnani.ai with a real-time "Read-Along" web player.

## Architecture

- **Client**: React 18 + Vite + Tailwind CSS + Shadcn/UI (deployed on Vercel)
- **Server**: Node.js 18+ + Express + TypeScript (deployed on Render)
- **Database & Storage**: Supabase Free Tier (PostgreSQL + S3-compatible Blob Storage)
- **AI Engine**: Gnani.ai REST API (timbre-v2.5)

## Monorepo Structure

```
ekithab-audio-pipeline/
├── client/                 # Frontend (Vite + React + TypeScript)
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── hooks/          # Custom React hooks
│   │   ├── services/       # API services
│   │   ├── types/          # TypeScript types
│   │   └── lib/            # Utilities
│   └── ...
├── server/                 # Backend (Express + TypeScript)
│   ├── src/
│   │   ├── routes/         # API routes
│   │   ├── services/       # Business logic
│   │   ├── middleware/     # Express middleware
│   │   ├── utils/          # Utilities
│   │   └── types/          # TypeScript types
│   └── ...
└── package.json            # Root workspace config
```

## Getting Started

### Prerequisites
- Node.js 18+
- npm 9+
- Supabase account (free tier)
- Gnani.ai API key

### Installation

```bash
# Install all dependencies
npm run install:all
```

### Environment Setup

**Server** (`server/.env`):
```env
GNANI_API_KEY_ID=your_gnani_key
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
PORT=3001
FRONTEND_URL=http://localhost:5173
```

**Client** (`client/.env`):
```env
VITE_API_URL=http://localhost:3001
```

### Development

```bash
# Start both client and server
npm run dev

# Or start individually
npm run dev:server  # Server on http://localhost:3001
npm run dev:client  # Client on http://localhost:5173
```

### Build

```bash
# Build both workspaces
npm run build
```

## API Contract

**Endpoint**: `POST /api/audio/synthesize`

**Request**:
```json
{
  "chapterId": "string",
  "text": "string",
  "language": "string",
  "voiceProfile": "string",
  "speed": "number"
}
```

**Response**:
```json
{
  "success": "boolean",
  "audioUrl": "string",
  "durationSeconds": "number",
  "alignment": [
    {
      "sentenceIndex": "number",
      "text": "string",
      "startTime": "number",
      "endTime": "number"
    }
  ]
}
```

## Deployment

- **Backend**: Render Web Service (root: `/server`, build: `npm install`, start: `node dist/index.js`)
- **Frontend**: Vercel (root: `/client`, preset: Vite)

## Security

- All API keys stored in server `.env` only
- Rate limiting: 5 requests/minute per IP
- CORS restricted to deployed frontend URL
- Atomic credit deduction on server

## License

Proprietary - eKithab Project