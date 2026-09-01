# Calibrate

A calorie tracker application, because I've gotten into healthier eating, jogging, and calisthenics.

## Experimenting with scaling myself with AI development flows - code may not be perfect

- I am changing when and how much I review code, including after first merging lower-risk feature changes
  onto the main branch, creating refactor commits after when I see chances to improve things, and updating skills and other agent context to
  catch things automatically.
- I may catch things later than I previously would have as a result.
- The reason I am doing this is that the industry is trending toward engineers scaling themselves by acting more like an engineering manager over a fleet of agents.
- Managers do not always review code, but rather ask for evidence that things worked, so I use review and validation pipelines that take screenshots, run E2E Playwright tests, and created a path for easy agent manual validation of authenticated routes.
- It is better to have agents also participate in review and validation, otherwise I become the bottleneck.
- Jobhunting is its own full-time effort, and does also mean I cannot devote constant attention to reviewing with a fine-toothed comb the large amounts of code AI agents can write.
- So I am investing in and testing systems that take a good amount of the review and validation burden off me, while still
  doing some manual verification like Amplitude's recent article on their usage of AI, and examining diffs from time to time for opportunities to simplify and improve the code.

## Frontend Current State

The current UI is partly a prototype built with mock data, with the Logs page able to load data for a day and add new food entries if you run the frontend and backend in development and sign up a user. The Goals page now loads live seven-day weight and fat charts, while the Overview (Dashboard) page loads live data for its charts and the Daily Insights area remains mock UI.

One goal is to show product judgment: take what could easily become dense, data-heavy areas in the Dashboard page, and keep it simple enough to be useful. The target user is not an expert mathematician or nutrition analyst, rather they are people wanting to change themselves, who may need help building new habits, and need to understand what to do next, and what is working or not working. The most important product work is surfacing actions and actionable insights that help them keep momentum with new habits, while suggesting small tweaks they may not have realized they can do that will help them get results.

Charts and data stay at overview level by default. When a user chooses to drill deeper, the app should still be selective about what it shows. More data is only useful when it creates a clearer insight, a better decision, or a practical adjustment the user can actually make.

### Screenshots

#### Dashboard page

Initial page:
<br></br>
<img width="1186" height="945" src="https://github.com/user-attachments/assets/5cce7cf3-c249-47bf-8a06-8b2ad832c64e" />
<br></br>
- A compact, rolling **Seven-Day Nutrition** section with both daily charts and the average over the last 7 days lets the user quickly gain a sense of how they are doing and if it is good to give efforts for special adjustments today. 
- On mobile screens it takes up half the screen, so that the next section for Habits also appears without scrolling and help the user build their habits.
- The **Habits** section is next in sequence, and gently encourages the user with to keep up their good work with calendar heatmaps and weekly usage stats. The acts of logging food and weight are so key to making progress; the awareness they bring to your current habits and how much for example snacking or higher calorie foods in your meals account for are priceless.
- The **Nutrition** section after has mini cards you can use to drill in deeper for that nutrient.

##### Nutrient Analytics
- Clicking a nutrient mini card from the Dashboard's **Nutrition** section opens an analytics panel, surfacing simple, actionable insights.
<br></br>
<img width="1197" height="850" src="https://github.com/user-attachments/assets/7aa0e2da-0bf5-4b1e-b1f0-7328e146e43f" />
<img width="487" height="906" alt="Screenshot 2026-09-01 at 11 29 52 AM" src="https://github.com/user-attachments/assets/ff7ab55b-3382-478a-95ac-b1c7f637212a" />
<br></br>
- In the Total tab, seeing what recently had the highest contributions to calories or fats especially can drive what to try reducing next.
<br></br>
- The Change tab lets you see both what you've been hard at work reducing, and what you didn't notice you've been increasing.
- You get both some congratulations and reinforcement, as well as suggestions about further eating trends to watch.

#### Daily Logs Page

<img width="1185" height="886" src="https://github.com/user-attachments/assets/da88edd0-00c5-4067-9104-35ae1b2640af" />
<br></br>
Each day starts with a compact summary of calories eaten, calories remaining, and macros with line graphs to give the user a quick sense of if their day is on the right track, and what they can still afford. As they are working on building new habits, it helps to know this information so they can quickly adjust in the same day.

Logging can be done via the floating Plus button, or an Add Item button under the specific meal to quickly reach logging for it, which a user will frequently do.

# Tech Stack

## Why Nx?

This project uses Nx to support a scalable monorepo architecture. Nx gives the codebase a clear project structure, strong tooling around dependency boundaries, and a better developer experience as the system grows.

- One of the main reasons for choosing Nx is its ability to understand the dependency graph of the workspace. This allows Nx to determine which projects are affected by a change and run only the relevant checks, such as tests, linting, typechecking, or builds. That keeps feedback fast while still giving confidence that related parts of the system have not been broken.
- Another reason for using Nx is future scalability. If parts of the backend eventually need to be extracted into separate services or microservices, having the code organized as independent projects inside a monorepo makes that transition easier. The workspace can evolve gradually without forcing an early split into multiple repositories.

In short, Nx was chosen because it provides:

- a structured monorepo setup
- automatic project dependency tracking
- affected-based testing, linting, typechecking, and builds
- faster local and CI feedback
- better support for enforcing architectural boundaries
- a smoother path toward future service extraction if the system grows in that direction

## Backend

Currently building out the backend as an Express.js app drawing from clean architecture layering to decouple business logic from particular technology choices.
Will use the backend to explore/practice various backend topics.

### Node.js/Express.js, not NestJS

- I chose Express.js over NestJS to demonstrate clean architecture from first principles.
  - NestJS comes with its own opinionated module system, dependency injection container, and decorator-based patterns. This can be valuable in production, but here they would obscure the point.
  - With Express.js as a thin HTTP layer, every boundary, dependency inversion, and layer relationship is something I explicitly designed rather than something the framework provided for me.

### Kysely, a SQL query builder, rather than an ORM

- I chose a type-safe query builder over an ORM (e.g. Prisma, TypeORM) for three reasons:
  1. **Clean architecture alignment.** ORMs couple persistence concerns to domain models through decorators or generated types. A query builder keeps the mapping between database rows and domain objects explicit and confined to the repository layer.
  2. **SQL control for future analytics.** A calorie tracker naturally leads to aggregation queries, such as weekly averages, macro breakdowns, trend lines. A query builder lets me write and optimize that SQL directly rather than working around an ORM's abstraction.
  3. **Full type safety over Knex.js.** Kysely infers return types from the query itself and provides autocomplete on table and column names, catching schema mismatches at compile time, things Knex.js doesn't offer.

## Frontend

- TanStack Router was chosen because it gives the app fully-typed routing with room to grow into route loaders for high network performance for mobile users taking time of their busy day to jot down meal entries.

- shadcn/ui is useful here for helping build battle-tested, accessible, polished UI quickly while still allowing keeping ownership over styling.

# Setup for Running Locally

## Common

1. Run `npm ci` in the project root.

## Git worktrees (shared Postgres)

Several linked git worktrees on one machine can share the existing Compose Postgres on `127.0.0.1:5433`. Each checkout gets its own database name, sticky frontend/backend ports, and matching API/CORS/WebAuthn URLs.

From the primary or a linked worktree:

```bash
npx nx run workspace:worktree-setup
```

Setup is idempotent. It will:

- copy `.env.keys` from the primary checkout when this worktree does not have it yet
- start the shared Postgres container only when `127.0.0.1:5433` is not already accepting connections (`COMPOSE_PROJECT_NAME=calibrate-shared`)
- create and migrate this worktree's database
- write gitignored `.worktree-dev.json` with the chosen ports and origins
- print copy-paste `backend:dev` and `web:dev` commands with the required env overrides

If no dotenvx key is available in this worktree, the primary checkout, or
`DOTENV_PRIVATE_KEY`, setup stops without provisioning anything. Setup does not
start Vite or Express; run the printed commands in separate terminals. Host
processes always talk to Postgres at `DB_HOST=127.0.0.1` and `DB_PORT=5433`.

The selected adjacent frontend/backend port pair is claimed in
`~/.calibrate/worktree-ports` by worktree path and reused when it is still
available. Teardown intentionally leaves that claim in place.

When you are done with a linked worktree database:

```bash
npx nx run workspace:worktree-teardown -- --database calibrate_wt_<slug>_<hash>
```

Teardown drops only this linked worktree's `calibrate_wt_*` database, deletes
this worktree's `.worktree-dev.json`, and leaves the shared Postgres container
running. It refuses the primary `.env` database, `postgres`, `template0`,
`template1`, and databases belonging to another worktree. Do not run `docker
compose down` for worktree cleanup.

The primary checkout keeps the `DB_NAME` from `.env`. Linked worktrees use `calibrate_wt_<slug>_<hash>` so same-named folders on different paths cannot collide.

## Backend

### Run locally

Use [Git worktree setup](#git-worktrees-shared-postgres). It starts only the
shared Postgres service, creates and migrates the selected database, and prints
the host `backend:dev` command. The Compose `backend` service is not part of
this worktree workflow.

### Initial dotenv configuration

1. Add a `.env` file to the project root. Set the following environment variables in it as strings, to the correct values. `DB_NAME` is the primary checkout database; shared local Postgres listens on `127.0.0.1:5433`.

```
DB_NAME="<primary_checkout_database>"
DB_HOST="127.0.0.1"
DB_PORT="5433"
DB_USER="postgres"
DB_PASSWORD="<local_postgres_password>"
JWT_KEY_ID="local-dev"
JWT_ACCESS_TOKEN_TTL_SECONDS="900"
JWT_ISSUER="http://localhost:3001/"
JWT_AUDIENCE="http://localhost:3001/api"
API_BASE_URL="http://localhost:3001/"
OTP_HMAC_KEY="<base64url_encoded_random_key_of_at_least_32_bytes>"
OTP_HMAC_CURRENT_KEY_VERSION="1"
EMAIL_REQUEST_IP_HMAC_KEY="<independent_base64url_encoded_random_key_of_at_least_32_bytes>"
EMAIL_VERIFICATION_GLOBAL_HOURLY_LIMIT="1000"
TRUST_PROXY_HOPS="0"
WEBAUTHN_RP_ID="localhost"
WEBAUTHN_ORIGIN="http://localhost:3000"
WEBAUTHN_RP_NAME="Calibrate"
EMAIL_SERVICE_CREDENTIAL="<brevo_api_key>"
```

`TRUST_PROXY_HOPS` must match the number of trusted reverse-proxy hops in front
of the backend (`0` for direct local development). It controls which address
Express exposes as the requesting IP; it does not authenticate the client.
`WEBAUTHN_ORIGIN` must match the frontend origin used for passkey ceremonies
(`http://localhost:3000` is the primary checkout default). Worktree setup
overrides the frontend port, `VITE_API_BASE_URL`, `CORS_ORIGIN`, and
`WEBAUTHN_ORIGIN` for the selected worktree pair. Use independently generated
values for `OTP_HMAC_KEY` and `EMAIL_REQUEST_IP_HMAC_KEY`.

2. Generate an Ed25519 private key .pem file using `openssl genpkey -algorithm ED25519 -out jwt-ed25519-private.pem`.

3. Copy the .pem file contents to the .env file like JWT_PRIVATE_KEY_PEM="-----BEGIN PRIVATE KEY-----\n(the_private_key)\n-----END PRIVATE KEY-----". It will be encrypted using dotenvx, which is a project dependency.

4. Run `npm ci` in the project root.

5. Run `npx dotenvx encrypt`. It should generate a .env.keys file with a private key, and encrypt the values in .env.
   Dotenvx docs [here](https://dotenvx.com/docs/learn/encrypting/introduction)

6. Run `npx nx run workspace:worktree-setup` to provision Postgres, create the worktree database, run migrations, and print the dev commands.

7. Run the printed `backend:dev` and `web:dev` commands in separate terminals.

8. Other commands can be run like `npx nx run (project_name):(command_name) (args)`. Project names are found in `apps/app-folder/package.json`'s `name` field, the available command names comes from the `scripts` field.

### Testing signup locally without Brevo

When the web frontend is running on the HTTP loopback origin configured by the
backend's `WEBAUTHN_ORIGIN` (the frontend origin printed by worktree setup),
the signup page shows a local-development-only section with an
**Authorize create passkey** button. Use it to create a disposable
`@example.test` account and continue directly to the existing passkey setup
page. This bypass is denied in production and does not create a deliverable
recovery email, so it is intended only for evaluating the local repository.
Nx documentation [here](https://nx.dev/docs/getting-started/tutorials/running-tasks#running-a-single-task)

### Inspecting authenticated pages locally without a passkey

For a quick manual check of the dashboard or other protected pages, provision
the current worktree first:

```bash
npx nx run workspace:worktree-setup
```

Run the printed backend and frontend commands in separate terminals, then open
the printed frontend URL at `/calibrate-monorepo/signup-login` in the agent
browser and click **Start local test session**. The server creates the
disposable local fixture session and the browser keeps the normal access and
refresh cookies; no passkey is created or stored. The button is available only
from the local loopback development UI, and the backend remains the
authoritative boundary.

Use **Authorize create passkey** when the task is specifically about passkey
registration or the real WebAuthn flow. The local test session does not satisfy
recent passkey re-authentication required by sensitive operations. See
[ADR-0004](apps/backend/docs/adr/0004-loopback-only-local-test-session.md) for
the security boundary and rationale.

### Building the backend Docker image

The backend Dockerfile is in `apps/backend`, but it must be built with the repository root as the Docker build context because it copies root workspace files and the shared `packages/api-contracts` package.

Run this from the repository root:

```bash
npx nx run backend:docker-build
```

Equivalent raw Docker command:

```bash
docker build -f apps/backend/Dockerfile -t dereksleung407/calibrate:latest .
```

Do not use `apps/backend` as the build context. Docker cannot copy files outside the context, so `docker build -f apps/backend/Dockerfile apps/backend` will fail when the Dockerfile tries to copy root files such as `package.json` or sibling workspace files such as `packages/api-contracts/package.json`.

## Frontend

### Running Frontend Locally

Use [Git worktree setup](#git-worktrees-shared-postgres), then run the printed
`web:dev` command. The frontend URL is the `frontendUrl` in
`.worktree-dev.json` and may differ between worktrees.
