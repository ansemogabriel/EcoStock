---
name: railway-database
description: Add and connect PostgreSQL, Redis, MySQL, or MongoDB services on Railway. Use when a user asks to add a database or connect an app to a Railway database.
metadata:
  short-description: Create and connect Railway databases
---

# Railway databases

Help manage official Railway database services: PostgreSQL, Redis, MySQL, and MongoDB. Use Railway's CLI and the project's available Railway integrations. The original Claude Code version uses a Claude plugin helper; that helper is not part of this skill.

## Workflow

1. Check that the Railway CLI is installed and authenticated, then inspect the linked project and environment with `railway status --json`.
2. Before creating anything, inspect the project's current services and environment configuration for a database of the requested type. Reuse an existing database when appropriate.
3. If a database needs to be created, identify the correct Railway project, environment, and workspace. Create the official database template for the requested type using an available Railway CLI or Railway integration operation. If the available tools cannot create templates, explain the missing capability instead of guessing at unsupported commands or calling Claude-specific helper scripts.
4. Wait for the new service to finish deploying and confirm it is healthy before wiring other services to it.
5. If the user asks to connect an app, identify the target service. When there are multiple plausible target services, ask which one. Add the connection as a Railway variable reference so secrets and internal URLs stay managed by Railway.
6. Confirm what was created or changed and provide the service and variable names.

## Official template codes

| Database | Template code | Typical internal reference |
| --- | --- | --- |
| PostgreSQL | `postgres` | `${{Postgres.DATABASE_URL}}` |
| Redis | `redis` | `${{Redis.REDIS_URL}}` |
| MySQL | `mysql` | `${{MySQL.MYSQL_URL}}` |
| MongoDB | `mongodb` | `${{MongoDB.MONGO_URL}}` |

Service names can differ. Check the actual Railway service name and available variables before composing a reference.

## Connection guidance

- Prefer Railway private/internal connection variables for server-side services in the same project.
- Browser code cannot reach Railway's private network. Route database access through a backend API. If direct public access is specifically required, explain that it needs a public TCP proxy and use the public variable supplied by Railway.
- Never print, copy into source code, or expose database credentials. Use Railway-managed variable references.
- Do not create a second database when a suitable one already exists unless the user asks for a separate instance.

## Common checks

- `railway status --json` should identify the linked project and environment. If no project is linked or authentication is missing, report the specific setup step needed.
- Check existing services/configuration before deployment. Railway database service images commonly identify Postgres, Redis, MySQL, or MongoDB, but confirm against the current service details.
- If Railway tools do not expose the needed template or environment operation, explain the limitation and give the user the relevant Railway dashboard/CLI next step. Do not invent a CLI subcommand or use a missing Claude plugin helper.
