# Manage Me Backend

NestJS backend for the Manage Me application. It uses PostgreSQL with TypeORM and exposes versioned APIs under `/api/v1`.

## Prerequisites

- Node.js with npm
- Docker Desktop or Docker Engine with Compose support

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Create your local environment file

```bash
cp .env.example .env
```

Minimum values to review in `.env`:

```env
PORT=3000
JWT_SECRET=local-dev-secret

DB_HOST=localhost
DB_PORT=5433
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=manage_me_db
DB_SYNCHRONIZE=true
```

Notes:

- `JWT_SECRET` is required. The app will not start without it.
- If you use the included `docker-compose.yml`, keep `DB_PORT=5433`.
- AI and integration variables can stay blank unless you are testing those features.

### 3. Start PostgreSQL

Start just the database:

```bash
docker compose up -d postgres
```

Or start PostgreSQL plus pgAdmin:

```bash
docker compose up -d
```

Local service URLs:

- PostgreSQL: `localhost:5433`
- pgAdmin: `http://localhost:5050`

Default database credentials:

- Database: `manage_me_db`
- Username: `postgres`
- Password: `postgres`

### 4. Start the API

```bash
npm run start:dev
```

The backend will be available at:

- API base URL: `http://localhost:3000/api/v1`
- Static uploads: `http://localhost:3000/uploads`

## First Login

There is no public signup endpoint in this backend. Seed an initial admin user and organization first.

### Seed a default admin and org

Uses these defaults if you do not override them:

- Admin email: `admin@example.com`
- Admin password: `password123`
- Organization name: `Default Org`
- Organization slug: `default-org`

Run the seed:

```bash
npm run seed:org
```

Optional custom seed values:

```bash
SEED_ADMIN_EMAIL=owner@example.com \
SEED_ADMIN_PASSWORD=changeme123 \
SEED_ADMIN_FIRST_NAME=Owner \
SEED_ADMIN_LAST_NAME=User \
SEED_ORG_NAME="My Org" \
SEED_ORG_SLUG=my-org \
npm run seed:org
```

### Log in

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password123"}'
```

The login response includes:

- `access_token`
- `user.organizations`
- `user.defaultOrgId`

For protected organization-scoped endpoints, send both:

- `Authorization: Bearer <access_token>`
- `x-org-id: <organization id>`

## Available Commands

```bash
npm run start
npm run start:dev
npm run start:prod

npm run build
npm run lint

npm run test
npm run test:e2e
npm run test:cov

npm run migration:generate -- src/migrations/MyMigration
npm run migration:run
npm run migration:revert
```

## Database Notes

- Local development usually works with `DB_SYNCHRONIZE=true`.
- The TypeORM CLI reads from `src/data-source.ts`.
- The Nest runtime database connection is configured in `src/database/database.module.ts`.

If you want to use your own PostgreSQL instance instead of Docker, update the database values in `.env` and start the app normally.

## Troubleshooting

### `JWT_SECRET is not defined in environment variables`

Set `JWT_SECRET` in `.env`, then restart the server.

### Cannot connect to Postgres

Check all of the following:

- `docker compose ps` shows the `postgres` container running
- `.env` uses `DB_HOST=localhost`
- `.env` uses `DB_PORT=5433` when running through Docker Compose

### Auth succeeds but protected requests fail

Most protected routes also require the `x-org-id` header. Use one of the organization IDs returned by the login endpoint.
