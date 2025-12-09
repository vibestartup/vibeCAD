# vibeCAD Library Server

Lightweight server for serving KiCad component libraries to the web client.

## Setup

### 1. Install Dependencies

```bash
cd app/server
pnpm install
```

### 2. Add KiCad Libraries

Option A: Clone essential KiCad libraries (recommended, ~500MB):

```bash
cd libraries
git clone --depth 1 --filter=blob:none --sparse https://gitlab.com/kicad/libraries/kicad-symbols.git kicad/symbols
cd kicad/symbols
git sparse-checkout set --cone
git sparse-checkout add Connector Device Transistor MCU_ST Power_Management

cd ..
git clone --depth 1 --filter=blob:none --sparse https://gitlab.com/kicad/libraries/kicad-footprints.git kicad/footprints
cd kicad/footprints
git sparse-checkout set --cone
git sparse-checkout add Connector_PinHeader_2.54mm Package_SO Package_QFP Resistor_SMD Capacitor_SMD
```

Option B: Use a pre-built subset (coming soon):

```bash
# Download pre-packaged subset
curl -L https://example.com/vibecad-kicad-libs.tar.gz | tar xz -C libraries/
```

### 3. Build Index

```bash
pnpm index-libraries
```

This creates `data/library-index.json` with searchable component metadata.

### 4. Run Server

Development:
```bash
pnpm dev
```

Production:
```bash
pnpm build
pnpm start
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Health check |
| `GET /api/libraries/kicad/index` | Full component index |
| `GET /api/libraries/kicad/categories` | Category tree |
| `GET /api/libraries/kicad/search?q=...` | Search components |
| `GET /api/libraries/kicad/components/:category` | Components by category |
| `GET /api/libraries/kicad/symbol/:file` | Symbol file content |
| `GET /api/libraries/kicad/footprint/:lib/:file` | Footprint file content |
| `GET /api/libraries/kicad/stats` | Library statistics |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3001 | Server port |
| `CORS_ORIGINS` | localhost:5173,localhost:3000 | Allowed CORS origins |
| `LIBRARY_PATH` | ./libraries/kicad | Path to KiCad libraries |
| `INDEX_PATH` | ./data/library-index.json | Path to index file |

## Storage Considerations

- Full KiCad libraries: ~2GB
- Essential subset (recommended): ~500MB
- Index file: ~5-10MB

The server only loads the index into memory. Individual symbol/footprint files are read on-demand.
