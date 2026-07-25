# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FinanceManagerApp is a full-stack personal finance manager. The public domain is **finanzasbr.com**.

- **Backend**: ASP.NET Core 9.0 Web API (`FinanceManager.API/`)
- **Frontend**: Angular 19 SPA (`finance-manager-ui/`)

---

## Commands

### Backend (`FinanceManager.API/`)

```bash
dotnet run                                          # Start API (dev mode)
dotnet build                                        # Build
dotnet test                                         # Run unit tests (from repo root)
dotnet ef migrations add <MigrationName>            # Create a new EF migration
dotnet ef database update                           # Apply migrations manually
```

The API auto-applies migrations on startup via `context.Database.Migrate()` in `Program.cs`.

Note: `dotnet build`/`dotnet test` fails with a file-lock error while `dotnet run` is
active. Stop the dev API first, or build elsewhere with `-p:BaseOutputPath=<dir>`.

### Frontend (`finance-manager-ui/`)

```bash
npm start          # Dev server at http://localhost:4200
npm run build      # Production build to dist/
npm test           # Run unit tests in a watching browser (Karma/Jasmine)
npm run test:ci    # Single headless run — use this to check the suite
ng generate component <name>   # Scaffold a new component
```

`karma.conf.js` points `CHROME_BIN` at the Chrome that puppeteer installs as a
devDependency, so `test:ci` needs no system Chrome. Specs run in random order.

---

## Architecture

### Backend

- **Framework**: ASP.NET Core 9.0 with ASP.NET Identity
- **Database**: PostgreSQL (Supabase) via EF Core (Npgsql). At startup `Program.cs` probes connection candidates with a real connection attempt: `DATABASE_URL` env var first (URI format, parsed), then `ConnectionStrings:DefaultConnection` — the first one that accepts connections wins. TEMPORARY: `DefaultConnection` is committed in `appsettings.json` pending a credential rotation (the old value leaked in the public repo); after rotating, new values go ONLY in Render env vars + local user secrets (`UserSecretsId` is in the csproj), never in committed files.
- **Auth**: JWT Bearer tokens. The signing key is the `TokenKey` config value (env var overrides `appsettings.json`); startup fails fast if it's missing or under 64 chars. TEMPORARY: committed pending rotation, same rule as above. Tokens are issued by `TokenService`.
- **Email**: Resend HTTP API (`EmailService`), configured via `RESEND_API_KEY`, `EMAIL_FROM`, and `EMAIL_FROM_NAME` environment variables (or the `Resend:*` config section). Used for email verification and password reset.
- **Currency**: `CurrencyService` (registered with `AddHttpClient`) fetches live exchange rates.
- **Debt math**: `Services/DebtCalculator.cs` holds the amortization and installment-rebalancing logic as pure static methods, kept free of EF and HTTP so it can be unit tested. `DebtsController` only orchestrates persistence around it — new money math belongs in the calculator, not the controller.

**Key files**:
- `Program.cs` — DI registration, CORS policy (allows `localhost:4200` and production domains), middleware pipeline
- `Data/AppDbContext.cs` — EF context extending `IdentityDbContext<AppUser>`; defines decimal precision for financial fields
- `Models/` — `AppUser`, `Transaction`, `SavingsAccount`, `Debt`, `Installment`
- `Controllers/` — `AccountController`, `TransactionsController`, `DebtsController`, `SavingsController`, `CurrencyController`
- `DTOs/` — Data transfer objects for all request/response shapes

**Tests**: `FinanceManager.API.Tests/` (xUnit) covers `DebtCalculator` — amortization
totals, rounding, due dates, partial regeneration and rebalancing after payments.

### Frontend

- **Framework**: Angular 19 with standalone components (no NgModules)
- **HTTP**: `jwtInterceptor` (`core/interceptors/jwt.interceptor.ts`) automatically attaches the Bearer token from `localStorage` to every outgoing request
- **Auth guard**: `authGuard` (`core/guards/auth.guard.ts`) checks `localStorage` for a `user` key; redirects to `/auth/login` if absent
- **API URL**: Configured in `src/environments/environment.ts` → `environment.apiUrl` (`https://api.finanzasbr.com/api/`)
- **i18n**: ngx-translate with three locales: `es` (default), `en`, `pt`. Translation files live in `src/assets/i18n/`
- **Charts**: Chart.js via ng2-charts, used in the dashboard
- **Theming**: Dark/light mode via `ThemeService` (`services/theme.service.ts`)
- **Tutorial**: driver.js powered walkthrough via `TutorialService`

**Route structure**:
- `/` → `LandingComponent` (public)
- `/auth/login`, `/auth/register`, `/auth/forgot-password`, `/auth/reset-password` → public auth flows
- `/dashboard` → main dashboard with transactions and charts (protected)
- `/debts` → debt management with installments (protected)
- `/savings` → savings accounts (protected)
- `/**` → redirects to `/auth/login`

All protected routes use `canActivate: [authGuard]` and are lazy-loaded.

**Service locations**:
- `core/services/` — `AuthService`, `TransactionService`, `CurrencyService`, `CurrencyStateService`, `LanguageService`, `TutorialService`
- `services/` — `DebtsService`, `SavingsService`, `ThemeService`
- `shared/models/` — shared TypeScript interfaces

**Tests**: specs live next to the code they cover. `src/testing/test-providers.ts`
exposes `provideTestingDependencies()` — HTTP (mocked), router and ngx-translate —
which every TestBed here needs; without it `createComponent` throws
`NullInjectorError`. The translate loader is a no-op, so assertions expect the raw
translation key. Money calculations (`DashboardComponent` totals and alerts,
`DebtsComponent.calculateMetrics`, `CurrencyStateService.convert`) are tested by
constructing the class directly with stubs, bypassing `ngOnInit`'s HTTP and timers.

### Deployment

- **API**: Deployed on Render as a Docker container (see `Dockerfile`). Listens on port `8080`.
- **Frontend**: Deployed on Vercel (`vercel.json` is present) and served at `finanzasbr.com`.
