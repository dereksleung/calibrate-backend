# Calibrate

A calorie tracker application, because I've gotten into healthier eating, jogging, and calisthenics.

## Currently experimenting with scaling myself with AI development flows

I am changing when and how much I review code, including potentially after first merging lower-risk feature changes
onto the main branch, creating refactor commits after when I see issues, and updating skills and other agent context to
catch things automatically.
I may catch things later than I previously would have as a result.
The reason I am doing this is that the industry is trending toward engineers scaling themselves by acting more like an engineering manager over a fleet of agents. Managers do not always review code, but rather ask for evidence that things worked, so I use review and validation pipelines that take screenshots, run E2E Playwright tests, and created a path for easy agent manual validation of authenticated routes. It is better to have agents also participate in review and validation, otherwise I become the bottleneck. Jobhunting is its own full-time effort, and does also mean I cannot devote constant attention to reviewing with a fine-toothed comb the large amounts of code AI agents can write.
So I am investing in and testing systems that take a good amount of the review and validation burden off me, while still
doing some manual verification like Amplitude's recent article on their usage of AI, and examining diffs from time to time for opportunities to simplify and improve the code.

## Frontend Current State

The current UI is partly a prototype built with mock data, with the Logs page able to load data for a day and add new food entries if you run the frontend and backend in development and sign up a user. Some pages do not load live data yet like the Dashboard or Goals pages.

One goal is to show product judgment: take what could easily become dense, data-heavy areas in the Dashboard and Goals pages, and keep them simple enough to be useful. The target user is not an expert mathematician or nutrition analyst, rather they are people wanting to change themselves, who may need help building new habits, and need to understand what to do next, and what is working or not working. The most important product work is surfacing actions and actionable insights that help them keep momentum with new habits, while suggesting small tweaks they may not have realized they can do that will help them get results.

Charts and data stay at overview level by default. When a user chooses to drill deeper, the app should still be selective about what it shows. More data is only useful when it creates a clearer insight, a better decision, or a practical adjustment the user can actually make.

### Screenshots

#### Dashboard page

Initial page:
<br></br>
<img width="1069" height="830" alt="Screenshot 2026-08-06 at 8 33 18 AM" src="https://github.com/user-attachments/assets/3136d5ef-6ad9-4a32-8011-b54b3f832ccd" />
<br></br>
On clicking the High Impact Swap card's Learn More link -> panel with actionable insights:
<br></br>
<img width="1307" height="939" alt="Screenshot 2026-06-25 at 8 54 35 PM" src="https://github.com/user-attachments/assets/24ca45ca-3fd2-4fc7-80ac-6a22f000e99c" />

<br></br>
Hovering over the Dashboard's Fats chart will show a tooltip saying you can click the chart to go to [a panel on the Goals page](#fats-analytics-panel), making that discoverable. Only the fats detail view mock UI is built right now.
<br></br>

#### Goals page

Allows deeper drilling into stats and progress.

Initial view - can see encouragement about journey, scrolling down you can see charts (weight and fats consumption only for now):
<br></br>
<img width="1067" height="908" alt="Screenshot 2026-08-06 at 8 34 05 AM" src="https://github.com/user-attachments/assets/9ca56e79-7b8f-45ba-bae8-7c78e8dbe670" />

<br></br>

#### Fats Analytics panel

Clicking the Fats bar chart opens a panel with deeper data the user can find trends with.
<br></br>
Greatest sources of fats by food in the last month:
<br></br>
<img width="1072" height="911" alt="Screenshot 2026-08-06 at 8 34 58 AM" src="https://github.com/user-attachments/assets/c5ec2173-62a7-4aa8-b7be-a7778005f236" />

<br></br>
Largest changes in fat contributions from food between last month to this month:
<br></br>
<img width="1076" height="904" alt="Screenshot 2026-08-06 at 8 35 08 AM" src="https://github.com/user-attachments/assets/4dfe83ae-75b3-4f83-bb6f-6e59b498ad06" />

<br></br>

#### Daily Logs Page

<img width="1032" height="851" alt="Screenshot 2026-08-06 at 8 59 02 AM" src="https://github.com/user-attachments/assets/8551ae2f-2a4c-4004-b300-507664362af0" />
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

## Backend

### Run locally with Docker

1. Run `npm ci` if you haven't yet.
2. Start Postgres first:

```bash
npx dotenvx run -- docker compose up -d postgres
```

3. Run database migrations.

```bash
npx dotenvx run --overload --env DB_HOST=127.0.0.1 DB_PORT=5433 -- npx nx run backend:kysely migrate:latest
```

4. Start the backend.

```bash
npx dotenvx run -- docker compose up backend
```

### From Scratch

1. Install PostgreSQL if needed.
   [Official installers here](https://www.postgresql.org/download/), [instructions on how to use them here](https://www.enterprisedb.com/docs/supported-open-source/postgresql/installing/).
   If you are installing PostgreSQL for the first time with an installer, it likely will ask you
   to set a superuser password, and a port number for the PostgreSQL server to listen for incoming connections. Note them.

2. Add a `.env` file to the project root. Set the following environment variables in it as strings, to the correct values. If you just installed PostgreSQL for the first time, the `DB_NAME` and `DB_USER` are "postgres".

```
DB_NAME="postgres"
DB_HOST="localhost"
DB_PORT="5432"
DB_USER="postgres"
DB_PASSWORD="<password_from_earlier>"
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
(`http://localhost:3000` when running the web app locally). Use independently
generated values for `OTP_HMAC_KEY` and `EMAIL_REQUEST_IP_HMAC_KEY`.

3. Generate an Ed25519 private key .pem file using `openssl genpkey -algorithm ED25519 -out jwt-ed25519-private.pem`.

4. Copy the .pem file contents to the .env file like JWT_PRIVATE_KEY_PEM="-----BEGIN PRIVATE KEY-----\n(the_private_key)\n-----END PRIVATE KEY-----". It will be encrypted using dotenvx, which is a project dependency.

5. Run `npm ci` in the project root.

6. Run `npx dotenvx encrypt`. It should generate a .env.keys file with a private key, and encrypt the values in .env.
   Dotenvx docs [here](https://dotenvx.com/docs/learn/encrypting/introduction)

7. Run `npx nx run backend:kysely migrate:latest`. Documentation for kysely's CLI [here](https://github.com/kysely-org/kysely-ctl), see "Project-scoped installation", as it is not installed globally.

8. Run `npx nx run backend:dev`.

9. Other commands can be run like `npx nx run (project_name):(command_name) (args)`. Project names are found in `apps/app-folder/package.json`'s `name` field, the available command names comes from the `scripts` field.

### Testing signup locally without Brevo

When the web frontend is running on the HTTP loopback origin configured by the
backend's `WEBAUTHN_ORIGIN` (`http://localhost:3000` by default), the signup
page shows a local-development-only section with an
**Authorize create passkey** button. Use it to create a disposable
`@example.test` account and continue directly to the existing passkey setup
page. This bypass is denied in production and does not create a deliverable
recovery email, so it is intended only for evaluating the local repository.
Nx documentation [here](https://nx.dev/docs/getting-started/tutorials/running-tasks#running-a-single-task)

### Inspecting authenticated pages locally without a passkey

For a quick manual check of the dashboard or other protected pages, start the
local services in separate terminals:

```bash
npx nx run backend:kysely migrate:latest
npx nx run backend:dev
VITE_API_BASE_URL=http://localhost:3001/api/v1 npx nx run web:dev
```

Open `http://localhost:3000/calibrate-monorepo/signup-login` in the agent browser and click
**Start local test session**. The server creates the disposable local fixture
session and the browser keeps the normal access and refresh cookies; no
passkey is created or stored. The button is available only from the local
loopback development UI, and the backend remains the authoritative boundary.

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

1. Start the dev server:

```bash
npx nx run web:dev
```

The app runs at:

```text
http://localhost:3000
```
