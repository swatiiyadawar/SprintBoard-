# SprintBoard API

Express API for projects and tasks. It uses PostgreSQL through `pg` and reads `DATABASE_URL` from `server/.env` (or the process environment). API responses use `{ "data": ... }`; errors use `{ "error": { "code": ..., "message": ... } }`.

## Local setup

Use Node.js 20 or newer and PostgreSQL 13 or newer. Create a PostgreSQL database and copy the example only when `.env` does not already exist:

```powershell
cd C:\Users\swati\Documents\ChatGPT\SprintBoard\server
npm ci
if (!(Test-Path .env)) { Copy-Item .env.example .env }
```

Edit `DATABASE_URL` in `server/.env` with your own connection string. For Supabase, use the database connection string from the project's Connect panel (Session pooler for local Node development) and set `PGSSL=true` if SSL is required. Keep this file private and never use a service key as a database password.

Apply versioned migrations only after confirming `DATABASE_URL` points to a local or development database, then start the API in separate terminals:

```powershell
cd C:\Users\swati\Documents\ChatGPT\SprintBoard\server
npm run db:migrate
npm run dev
```

The migration runner uses a private schema ledger, a transaction and advisory lock per migration, and skips recorded files. The SQL migrations also use idempotent DDL so an existing Phase 1 Supabase schema can be adopted safely.

## Endpoints

| Method | Path | Behavior |
| --- | --- | --- |
| GET | `/api/health` | Checks API and database connectivity |
| GET, POST | `/api/projects` | List projects / create a project |
| GET, PATCH, DELETE | `/api/projects/:projectId` | Read, update, or delete a project (task rows cascade on delete) |
| GET | `/api/tasks` | List tasks; supports `status`, `priority`, `assignee`, `projectId`, `limit`, and `offset` |
| POST | `/api/tasks` | Create a task; body requires `projectId` and `title` |
| GET, PATCH, DELETE | `/api/tasks/:taskId` | Read, update, or delete a task |
| GET | `/api/tasks/:taskId/activity` | List task activity, newest first |
| GET, POST | `/api/tasks/:taskId/dependencies` | List prerequisites / add one with `{ "dependsOnTaskId": "<task UUID>" }` |
| DELETE | `/api/tasks/:taskId/dependencies/:dependsOnTaskId` | Remove a prerequisite |
| GET | `/api/tasks/:taskId/dependents` | List tasks directly blocked by this prerequisite |
| GET | `/api/tasks/:taskId/impact` | List direct and indirect downstream tasks with their chain depth |
| GET, POST | `/api/tasks/:taskId/comments` | List comments / create a comment with `{ "body": "..." }` |
| PATCH, DELETE | `/api/tasks/:taskId/comments/:commentId` | Edit or delete a comment |

Phase 1 aliases remain available: `/health`, `GET /api/projects/:projectId/tasks`, and `POST /api/projects/:projectId/tasks`.

Task status values: `backlog`, `in_progress`, `in_review`, `done`. Priority values: `urgent`, `high`, `medium`, `low`. Project keys are unique, uppercase, and at most 12 characters. Task responses contain a UUID `id` plus a human-readable project key such as `PLAT-1` in `key`.

Task assignment is stored as free-text `assigneeName` (the app has no user or workspace-member model yet); due dates use `dueDate` in `YYYY-MM-DD` format or `null`. The task detail panel can edit these values and task creation accepts them. Dependencies are directed prerequisite links. New links require both tasks to exist in the same project; self-links and circular chains are rejected. The existing `task_dependencies` table from migration `005_create_task_dependencies.sql` is reused; its primary key prevents duplicate links, its check prevents self-links, both foreign keys cascade on task deletion, and the reverse index supports dependent lookups. Historical cross-project links, if present, are preserved and remain visible, but new cross-project links are rejected.

Task lifecycle and dependency events are written to `task_activity` in the same transaction as the task or dependency change. Event details retain before/after values or the related task key/title. Migration `006_create_task_activity.sql` adds the history table; migration `007_task_dependency_activity.sql` extends its allowed event types for dependency additions and removals. Actor identity is not recorded because authentication and a user model are not implemented; events show what changed and when, not who changed it.

Comments are stored in `task_comments`, scoped to a task, and cascade-delete with that task. Comment bodies must contain 1–5000 non-whitespace characters. No comment author is stored because this application does not yet have authenticated users. The task details panel shows prerequisites, direct dependents, and all downstream impact with chain depth using stored task relationships.

Example calls (PowerShell):

```powershell
curl.exe http://localhost:3001/api/health
curl.exe http://localhost:3001/api/projects
curl.exe "http://localhost:3001/api/tasks?status=in_progress&priority=high&limit=20"
curl.exe -X POST http://localhost:3001/api/projects -H "Content-Type: application/json" -d '{"name":"Platform","key":"PLAT"}'
```

## Security boundary

The API does not implement authentication or workspace authorization. Assignee names are free text because no user directory exists. Anyone who can reach the API can read, create, edit, or delete project/task data, activity events, comments, and dependencies. Do not expose it to multiple users or deploy it publicly until authenticated identity, project membership checks, and corresponding RLS policies are implemented. RLS is enabled on `projects`, `tasks`, `task_comments`, `task_dependencies`, and `task_activity` with no access policies yet, so direct Data API access is denied by default. The server database credential is a trusted server-side secret and must never be sent to the browser.
