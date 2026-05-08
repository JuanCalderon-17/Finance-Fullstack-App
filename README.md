# FinanceManagerApp

A full-stack personal finance manager deployed in production at **[finanzasbr.com](https://finanzasbr.com)**. Tracks transactions, debts with installment schedules, and savings accounts across multiple currencies, with secure JWT authentication and a multi-language UI.

Built end-to-end (backend, frontend, database, deployment) by **[Juan Calderón](https://linkedin.com/in/juancalderona)** as a final-year CS project.

---

## Live demo

| Frontend | API | Status |
|---|---|---|
| [finanzasbr.com](https://finanzasbr.com) | [api.finanzasbr.com](https://api.finanzasbr.com) | Production |

> Tip for reviewers: register a fresh account or use your own — no test credentials are committed to the repo. The API runs on Render's free tier and may take ~10s to wake on the first request after inactivity (a warm-up indicator is shown in the UI).

---

## Tech stack

**Backend**
![C#](https://img.shields.io/badge/C%23-%23239120.svg?style=for-the-badge&logo=csharp&logoColor=white)
![ASP.NET Core 9](https://img.shields.io/badge/ASP.NET%20Core%209-512BD4?style=for-the-badge&logo=dotnet&logoColor=white)
![Entity Framework Core](https://img.shields.io/badge/EF%20Core-512BD4?style=for-the-badge&logo=dotnet&logoColor=white)
![JWT](https://img.shields.io/badge/JWT-black?style=for-the-badge&logo=jsonwebtokens&logoColor=white)

**Frontend**
![Angular 19](https://img.shields.io/badge/Angular%2019-DD0031?style=for-the-badge&logo=angular&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)

**Database**
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-%23316192.svg?style=for-the-badge&logo=postgresql&logoColor=white)

**Infrastructure**
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![Render](https://img.shields.io/badge/Render-46E3B7?style=for-the-badge&logo=render&logoColor=black)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)

---

## Features

### Auth & accounts
- JWT bearer-token authentication with ASP.NET Identity
- Password reset by email (SendGrid + MailKit)
- Per-user data isolation enforced at every endpoint

### Transactions
- Categorized income and expenses with monthly filters
- Server-side filtering by month/year (handles large histories without loading the full list)
- Chart.js dashboard summarizing distribution by category
- Half-month filter (1st / 2nd half) for granular tracking

### Debts with installment schedules
- Auto-generates an installment schedule from balance, interest rate, and term
- Editable per-installment amounts (handles renegotiations and irregular payments)
- Edits to balance or interest rate **regenerate only unpaid installments**, preserving payment history
- Progress bar driven by actual paid amounts vs. total installment amounts (not the original formula), so the UI stays truthful when the user has manually adjusted installments
- Last installment absorbs rounding differences so totals reconcile exactly

### Savings accounts
- Multiple accounts with goals, color-coding, and progress tracking

### Currency
- Live USD ↔ BRL exchange rates fetched at runtime
- Per-user currency preference, with conversion handled centrally on the frontend

### Internationalization & UX
- Three languages: Spanish, English, Portuguese (ngx-translate)
- Dark / light theme via CSS custom properties and a theme service
- Guided onboarding tour using driver.js
- Animated landing page with `motion` library (SVG path animations + per-letter title rise)

---

## Architecture

```
              ┌──────────────────────────────────┐
              │   Vercel — finanzasbr.com        │
              │   Angular 19 SPA (lazy routes)   │
              └──────────────┬───────────────────┘
                             │
                             │  HTTPS + JWT bearer
                             │  (jwtInterceptor)
                             ▼
              ┌──────────────────────────────────┐
              │   Render — api.finanzasbr.com    │
              │   ASP.NET Core 9 Web API         │
              │   Docker container, port 8080    │
              └──────────────┬───────────────────┘
                             │
                             │  EF Core (Npgsql)
                             ▼
              ┌──────────────────────────────────┐
              │   Supabase — PostgreSQL 16       │
              │   Auto-migrated on startup       │
              └──────────────────────────────────┘
```

**Repo layout**

```
FinanceManagerApp/
├── FinanceManager.API/        # ASP.NET Core backend
│   ├── Controllers/           # AccountController, TransactionsController, DebtsController, SavingsController, CurrencyController
│   ├── Models/                # AppUser, Transaction, Debt, Installment, SavingsAccount
│   ├── DTOs/                  # Request/response shapes (validated with DataAnnotations)
│   ├── Data/AppDbContext.cs   # EF Core context (decimal precision, indexes, cascade rules)
│   ├── Services/              # TokenService, EmailService, CurrencyService
│   └── Program.cs             # DI, CORS, middleware, auto-migration on startup
└── finance-manager-ui/        # Angular 19 frontend
    ├── src/app/auth/          # login, register, forgot-password, reset-password
    ├── src/app/dashboard/     # transactions + chart
    ├── src/app/pages/         # landing, debts, savings
    ├── src/app/core/          # services, guards, interceptors
    └── src/assets/i18n/       # es.json, en.json, pt.json
```

---

## Getting started

### Prerequisites

- **.NET 9 SDK**
- **Node.js 20+** and **Angular CLI 19** (`npm install -g @angular/cli`)
- **PostgreSQL 16** running locally (or a Supabase / cloud connection string)

### Backend

```bash
cd FinanceManager.API

# Update the DefaultConnection in appsettings.json to point to your DB.
# Migrations run automatically on startup — no manual ef update required.

dotnet run
# API listens on http://localhost:8080
```

### Frontend

```bash
cd finance-manager-ui
npm install
npm start
# App at http://localhost:4200
```

The frontend points at `https://api.finanzasbr.com/api/` by default. To run against a local API, edit [`src/environments/environment.ts`](finance-manager-ui/src/environments/environment.ts) and set `apiUrl` to `http://localhost:8080/api/`.

---

## Engineering highlights

A few decisions worth calling out for code reviewers:

- **Auto-migrations on startup** ([`Program.cs`](FinanceManager.API/Program.cs)) — the API calls `context.Database.Migrate()` at boot, so production DB schema stays in lockstep with the deployed binary. No manual ops step on Render.
- **Server-side transaction filtering** — date filters move server-side via query params, so the dashboard doesn't load full history into memory just to show January.
- **DB indexes on `(AppUserId, TransactionDate)` and `(AppUserId, Category)`** — added explicitly in `AppDbContext.OnModelCreating` to keep the dashboard's two main query paths fast as the table grows.
- **Centralized currency conversion** — `CurrencyStateService` on the frontend is the single source of truth for the active currency and conversion rates, so individual components don't reimplement conversion math.
- **OnPush change detection on the dashboard** — combined with explicit `markForCheck()` after async loads, to keep large transaction lists from re-rendering on unrelated state changes.
- **Installment edit semantics** — when a user edits a debt's balance or term, only **unpaid** installments are removed and regenerated. Paid installments are kept as historical records. The API also rejects reducing the term below the number of already-paid installments.
- **Health endpoint** (`/api/health`) prevents Render's free tier from cold-starting on real user traffic.
- **`prefers-reduced-motion` respected** in animated UI (landing page, dashboard transitions).

---

## What's intentionally missing

Honest about scope so reviewers know what's been thought about vs. what's still on the list:

- **Rate limiting** on `/auth/login` — planned, not yet implemented
- **Email verification on signup** — currently any email is accepted
- **Refresh token rotation** — currently single-token JWTs; refresh flow planned
- **Account deletion / data export (GDPR)** — planned
- **Unit / integration test coverage** — currently none on the backend; a few scaffolded specs on the frontend. Adding xUnit tests for the financial logic (`GenerateInstallments`, currency conversion) is the next priority.

---

## License

This project is open source under the [MIT License](LICENSE).

---

## Contact

**Juan Calderón** — final-year Computer Science student
- LinkedIn: [linkedin.com/in/juancalderona](https://linkedin.com/in/juancalderona)
- X: [@FuanMDM](https://x.com/FuanMDM)
- Email: juanmoranca@gmail.com
