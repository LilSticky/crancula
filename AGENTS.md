# Crancula Agent Instructions

Domain language should be used and updated if unclear. Find it in `DEFINITIONS.md`.

The purpose and target of this project is describe in `FEATURES.md`.

## Project Overview
Crancula is an Electron-based Angular application for composing and converting punched tape music scores. It uses Angular 21 with TypeScript and Electron for desktop functionality, with a focus on music score management and conversion between formats.

The project is intended to explore Electron and new features of Angular.

## Key Commands
- `npm start` - Start development server (Angular + Electron)
- `npm run electron:serve` - Start Electron app with Angular development server
- `npm run electron:local` - Build web assets and run Electron app locally
- `npm run electron:build` - Build Electron application for distribution
- `npm run test` - Run unit tests
- `npm run test:watch` - Run unit tests in watch mode
- `npm run e2e` - Run end-to-end tests
- `npm run lint` - Run linting
- `npm run build` - Build web application

## Architecture
- **Frontend**: Angular 21 application with TypeScript and SCSS
- **Backend**: Electron-based desktop application with Node.js integration
- **Build System**: Uses Angular CLI with custom webpack configuration
- **Testing**: Unit tests with Vitest, E2E tests with Playwright
- **Translation**: Uses @ngx-translate for internationalization

## Important Details
- The application uses Angular's application builder (`@angular/build:application`) rather than custom webpack builders for standard builds
- Main Electron process in `app/main.js`
- Angular routing configured in `src/app.routes.ts`
- Application entry point is `src/main.ts`
- The app has a main Electron window that loads the Angular app (`src/index.html`)
- Uses the `@api/*` path mapping that includes `api/index.ts` in the app's package.json
- Environment configurations in `src/environments/` with dev/prod variants

## Development Workflow
- Run `npm start` to start development server
- For development with live reload: `npm run electron:serve`
- For local testing without building: `npm run electron:local`
- Tests run on both components and e2e flows
- Linting runs before tests and build

## Package Structure
- `src/` - Angular application code
- `app/` - Electron main and renderer processes
- `api/` - Shared data interfaces
- `e2e/` - End-to-end tests with Playwright
- `dist/` - Build output directory

## Testing Notes
- Unit tests are configured to use Vitest with browser mode
- E2E tests are handled by Playwright
- The application uses a test configuration in angular.json for testing
- Coverage reports generated for unit tests
