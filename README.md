# vibeCAD

A Turborepo monorepo project with TypeScript and React (TSX).

## Structure

- `app/` - Applications (TSX/React)
  - `public/` - Public-facing application
  - `admin/` - Admin application
  - `web/` - Web application
  - `mobile/` - Mobile application
  - `desktop/` - Desktop application
- `packages/` - Shared packages (TypeScript)
  - `core/` - Core utilities and shared logic
  - `kernel/` - Kernel for isolated iteration
  - `db/` - Database utilities and schemas

## Getting Started

Install dependencies:

```bash
pnpm install
```

Run all apps in development mode:

```bash
pnpm run dev
```

Build all apps:

```bash
pnpm run build
```

Run linting:

```bash
pnpm run lint
```

Format code:

```bash
pnpm run format
```

## Workspaces

This monorepo uses pnpm workspaces and Turborepo for task orchestration. Each app and package can be developed independently while sharing common dependencies and build configurations.

## Tech Stack

- **Monorepo**: Turborepo
- **Package Manager**: pnpm workspaces
- **Language**: TypeScript
- **UI Framework**: React (TSX) for apps
- **Build Tool**: TypeScript Compiler (tsc)
