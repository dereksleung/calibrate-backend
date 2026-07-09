# Calibrate

A calorie tracker application, because I've gotten into healthier eating, jogging, and calisthenics.

Currently building out the backend as an Express.js app with clean architecture layering to decouple business logic from particular technology choices. Will use the backend to explore/practice various backend topics.

## Frontend Current State
The current UI is a prototype built with mock data, most things are not actually functional, pages do not load live data yet. That is intentional. I'm working first on the product direction, information hierarchy, and interaction patterns.

The first goal right now is to use product judgment: take what could easily become dense, data-heavy areas in the Dashboard and Goals pages, and keep them simple enough to be useful. The target user is not an expert mathematician or nutrition analyst, rather they are people wanting to change themselves, who may need help building new habits, and need to understand what to do next, and what is working or not working. The most important product work is surfacing actions and actionable insights that help them keep momentum with new habits, while suggesting small tweaks they may not have realized they can do that will help them get results.

Charts and data stay at overview level by default. When a user chooses to drill deeper, the app should still be selective about what it shows. More data is only useful when it creates a clearer insight, a better decision, or a practical adjustment the user can actually make.

### Screenshots
#### Dashboard page
Initial page:
<br></br>
<img width="1291" height="827" alt="Screenshot 2026-06-25 at 8 52 29 PM" src="https://github.com/user-attachments/assets/d2c1dd68-4c20-4f66-832d-b57d9ec203f7" />
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
<img width="1247" height="936" alt="Screenshot 2026-07-09 at 3 31 44 PM" src="https://github.com/user-attachments/assets/f42692fe-ddc1-419d-b1cc-4d2b1bdb2b8e" />

<br></br>

#### Fats Analytics panel
Clicking the Fats bar chart opens a panel with deeper data the user can find trends with.
<br></br>
Greatest sources of fats by food in the last month:
<br></br>
<img width="1226" height="933" alt="Screenshot 2026-07-09 at 3 51 04 PM" src="https://github.com/user-attachments/assets/2088d778-4ae3-46f1-897e-64c3a15a9b31" />
<br></br>
Largest changes in fat contributions from food between last month to this month:
<br></br>
<img width="1224" height="933" alt="Screenshot 2026-07-09 at 3 55 49 PM" src="https://github.com/user-attachments/assets/59ceb1b6-9d9c-46b0-8cdf-a81dcde74315" />
<br></br>

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
```

3. Generate an Ed25519 private key .pem file using `openssl genpkey -algorithm ED25519 -out jwt-ed25519-private.pem`.

4. Copy the .pem file contents to the .env file like JWT_PRIVATE_KEY_PEM="-----BEGIN PRIVATE KEY-----\n(the_private_key)\n-----END PRIVATE KEY-----". It will be encrypted using dotenvx, which is a project dependency.

6. Run `npm ci` in the project root.

7. Run `npx dotenvx encrypt`. It should generate a .env.keys file with a private key, and encrypt the values in .env.
   Dotenvx docs [here](https://dotenvx.com/docs/learn/encrypting/introduction)

8. Run `npx nx run backend:kysely migrate:latest`. Documentation for kysely's CLI [here](https://github.com/kysely-org/kysely-ctl), see "Project-scoped installation", as it is not installed globally.

9. Run `npx nx run backend:dev`.

10. Other commands can be run like `npx nx run (project_name):(command_name) (args)`. Project names are found in `apps/app-folder/package.json`'s `name` field, the available command names comes from the `scripts` field.
Nx documentation [here](https://nx.dev/docs/getting-started/tutorials/running-tasks#running-a-single-task)

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
