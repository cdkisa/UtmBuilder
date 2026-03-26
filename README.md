# UTM Builder

A web application for creating, managing, and organizing UTM-tagged campaign URLs. Built with React, Vite, and Tailwind CSS, with all data stored locally in the browser using IndexedDB (Dexie.js).

## Features

- **Link Management** -- Create UTM-tagged URLs with campaign, medium, source, term, and content parameters. Supports bulk import/export via CSV.
- **Templates** -- Save reusable UTM templates to standardize link creation across campaigns.
- **Parameters** -- Manage predefined values for each UTM parameter (medium, source, campaign, etc.) to ensure consistency.
- **Custom Parameters** -- Define additional query parameters beyond the standard UTM set.
- **Attributes** -- Attach custom metadata fields to links for organization and filtering.
- **QR Codes** -- Generate styled QR codes for any link with customizable colors, patterns, corners, and logo overlays.
- **Link Shorteners** -- Configure link shortener integrations with custom domains.
- **Rules** -- Set up validation and automation rules for link creation.
- **Members** -- Manage team member access and roles.
- **Workspace Settings** -- Configure space character handling, prohibited characters, lowercase enforcement, and template requirements.

## Tech Stack

- **React 18** with React Router v6
- **Vite** for development and builds
- **Tailwind CSS** for styling
- **Dexie.js** (IndexedDB) for client-side data persistence
- **qr-code-styling** for QR code generation
- **nanoid** for short code generation
- **Playwright** for end-to-end testing

## Getting Started

### Prerequisites

- Node.js 18+

### Install and Run

```bash
npm install
npm run dev
```

The app will be available at `http://localhost:5173`.

### Build for Production

```bash
npm run build
npm run preview
```

### Run Tests

```bash
npm test
```

To run tests in headed mode:

```bash
npm run test:headed
```

## Project Structure

```
src/
  components/    # Shared UI components (Header, Sidebar, Modal)
  hooks/         # Custom React hooks (useToast, useWorkspace)
  pages/         # Page components for each feature
  utils/         # Utility functions (UTM building, CSV parsing, clipboard)
  db.js          # Dexie.js database schema and seed data
tests/           # Playwright end-to-end tests
```

## License

MIT
