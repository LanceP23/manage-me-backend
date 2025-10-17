<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## PostgreSQL Database Setup

This project uses PostgreSQL as its database. You can run PostgreSQL using Docker for easy setup and development.

### Docker Setup (Recommended)

1. Make sure you have Docker installed and running
2. Start the PostgreSQL database:
   ```bash
   docker compose up -d
   ```
   
   This starts PostgreSQL mapped on host port `5433` (container is `5432`).

3. Connection details (from your host):
   - Host: `localhost` (or `127.0.0.1`)
   - Port: `5433`
   - Username: `postgres`
   - Password: `postgres`
   - Database: `manage_me_db`
   - URL: `postgres://postgres:postgres@localhost:5433/manage_me_db`

4. Connecting from another device on your LAN:
   - Host: your PC's LAN IP (find with `ipconfig` → IPv4 Address)
   - Ensure Windows Firewall allows inbound TCP `5433`
   - Same username/password/database as above

5. Optional: If you add `pgadmin` service later, expose it (e.g. `5050`) and connect to host `postgres` (service name) on port `5432` inside the compose network.

### Manual Setup (Alternative)

If you prefer to use your own PostgreSQL installation:

1. Install PostgreSQL on your machine
2. Create a database (default name: `manage_me_db`)
3. Update the `.env` file with your database credentials

### Environment Variables

The following environment variables are used for database configuration:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5433
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=manage_me_db
DB_SYNCHRONIZE=true
DB_LOGGING=false
DB_SSL=false
```

### Database Commands

- Generate migration: `npm run migration:generate -- src/migrations/MyMigration`
- Run migrations: `npm run migration:run`
- Revert migration: `npm run migration:revert`

If you need to bypass a malformed local `.env` during CLI runs:
```bash
cmd /c "set NO_DOTENV=true & set DB_HOST=127.0.0.1 & set DB_PORT=5433 & set DB_USERNAME=postgres & set DB_PASSWORD=postgres & set DB_NAME=manage_me_db & npm run migration:run"
```

## Where the DB connection is initialized (NestJS)

- Runtime (app boot): `src/database/database.module.ts`
  - Uses `TypeOrmModule.forRoot({...})` with values from `src/config/database.config.ts` to create the TypeORM connection for the Nest app.
- CLI (migrations): `src/data-source.ts`
  - Provides the TypeORM `DataSource` for CLI commands like migrations.
  - We scope entities to `src/**/*.entity.{ts,js}` to avoid importing test files.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).