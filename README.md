# vibeCAD

A browser-native, parametric CAD system built with TypeScript and React. Features sketch-plane editing, constraint-based design, and 3D solid modeling powered by OpenCascade.js.

## Prerequisites

- **Node.js** >= 18
- **pnpm** >= 9.0.0

If you don't have pnpm installed:
```bash
npm install -g pnpm
```

## Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd vibeCAD
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Run the web app**
   ```bash
   pnpm dev:web
   ```

4. **Open in browser**

   Navigate to [http://localhost:3000](http://localhost:3000) (or the port shown in terminal if 3000 is in use)

## Project Structure

```
vibeCAD/
├── app/
│   └── web/              # Main web application (React + Vite)
├── packages/
│   ├── core/             # CAD data structures, types, and pure logic
│   ├── kernel/           # OpenCascade.js WASM bindings
│   └── react/            # Shared React components
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

## Available Scripts

From the root directory:

| Command | Description |
|---------|-------------|
| `pnpm install` | Install all dependencies |
| `pnpm dev:web` | Start the web app in development mode |
| `pnpm dev` | Start all apps in development mode |
| `pnpm build` | Build all packages and apps |
| `pnpm typecheck` | Run TypeScript type checking |
| `pnpm lint` | Run linting |
| `pnpm format` | Format code with Prettier |
| `pnpm clean` | Clean build artifacts |

## Features

- **3D Viewport**: Interactive Three.js viewport with orbit controls
- **Sketch System**: Create 2D sketches on planes
- **Operations Timeline**: Visual operation history with rollback capability
- **Parametric Modeling**: Extrude sketches to create 3D geometry
- **Undo/Redo**: Full history support

## Tech Stack

- **Monorepo**: Turborepo + pnpm workspaces
- **Language**: TypeScript (strict mode)
- **UI Framework**: React 18
- **State Management**: Zustand
- **3D Rendering**: Three.js
- **CAD Kernel**: OpenCascade.js (WASM)
- **Build Tool**: Vite

## Development

The web app runs on Vite with hot module replacement (HMR). Changes to source files will automatically reload in the browser.

### Package Dependencies

The web app depends on internal packages that are built automatically:
- `@vibecad/core` - Core CAD logic and types
- `@vibecad/kernel` - OpenCascade.js bindings
- `@vibecad/react` - Shared React components

Turborepo handles the build order automatically.

## License

MIT
