# Inkloom AI

Inkloom AI is a MERN + LangChain + RAG **brand governance platform**. Organizations store approved guidelines, terminology, claims, and assets; creators submit drafts; the system runs deterministic checks plus retrieval-augmented LLM review; humans approve or reject. The AI **never publishes** content.

This repository is a working application, not a UI-only prototype. Analytics, findings, and reviews persist in MongoDB. Source retrieval is scoped to the current workspace. LLM output is validated with Zod. Missing evidence is labeled **Needs Verification** — never invented.

## Architecture

```
React (Vite)  →  Express REST API  →  MongoDB (Mongoose)
                      │
                      ├── JWT auth + RBAC + workspace isolation
                      ├── Deterministic rule engine
                      ├── Document extract / chunk
                      ├── Cloudinary authenticated file storage
                      ├── Google Generative AI embeddings
                      ├── Qdrant vector search (workspace + approved + active version)
                      └── LLM providers (Groq primary, Gemini fallback) via LangChain
```

### Roles

| Role     | Capabilities                                                                     |
| -------- | -------------------------------------------------------------------------------- |
| ADMIN    | Members, sources, rules, claims, terminology, assets, analytics, audit, versions |
| CREATOR  | Drafts, AI reviews, finding actions, revisions, submit / resubmit                |
| MANAGER  | Review queue, comments, assign reviewers, request changes                        |
| REVIEWER | Inspect evidence, approve / reject, escalate                                     |

Permissions are enforced on the **backend**. Frontend roles are display-only.

### Review workflow

`DRAFT → SUBMITTED → AI_REVIEWED → CHANGES_REQUESTED → RESUBMITTED → PENDING_APPROVAL → APPROVED | REJECTED`

High-severity / critical findings require an authorized human decision before approval.

## Folder structure

```
inkloom-ai/
  client/                 React + Vite + Tailwind dashboard
  server/
    src/
      config/             env, mongo, qdrant
      models/             Mongoose schemas
      routes/             Express routers
      controllers/
      middleware/
      services/
        ai/               Groq / Gemini provider interface
        rag/              embeddings, indexing, retrieval
        review/           pipeline, deterministic engine
        documents/        PDF extract, storage
      validators/
      utils/
      app.js
    tests/
    scripts/              seed-demo.js
    .env.example
  README.md
```

## Prerequisites

- Node.js 20+
- MongoDB 6+ (local or Atlas)
- Qdrant (local Docker or Qdrant Cloud) for indexing / RAG
- API keys:
  - **Required for AI review:** `GROQ_API_KEY` and/or `GEMINI_API_KEY`
  - **Required for embeddings / Qdrant indexing:** `GEMINI_API_KEY` (Google Generative AI embeddings)
  - **Required for vector search:** a running Qdrant instance

The dashboard, auth, drafts, knowledge-base CRUD, workflow, analytics, and audit logs work **without** LLM keys. AI review and source indexing require the services above. Failures return explicit errors; they do not invent findings.

## Installation

```bash
# Server
cd server
cp .env.example .env
# Edit .env with your MongoDB URI, JWT secret, and keys
npm install

# Client
cd ../client
npm install
```

On Windows PowerShell, copy env with:

```powershell
cd server
Copy-Item .env.example .env
```

## Environment configuration

See `server/.env.example`.

| Variable                                           | Required                  | Purpose                                         |
| -------------------------------------------------- | ------------------------- | ----------------------------------------------- |
| `PORT`                                             | no (default 5000)         | API port                                        |
| `MONGODB_URI`                                      | **yes**                   | MongoDB connection string                       |
| `JWT_SECRET`                                       | **yes**                   | Sign access tokens                              |
| `CLIENT_URL`                                       | no                        | CORS origin (default `http://localhost:5173`)   |
| `GROQ_API_KEY`                                     | for primary LLM           | Groq chat completions                           |
| `GROQ_MODEL`                                       | no                        | Default `llama-3.3-70b-versatile`               |
| `GEMINI_API_KEY`                                   | embeddings + fallback LLM | Google Generative AI                            |
| `GEMINI_MODEL`                                     | no                        | Default `gemini-2.0-flash`                      |
| `EMBEDDING_MODEL`                                  | no                        | Default `text-embedding-004`                    |
| `EMBEDDING_DIMENSIONS`                             | no                        | Must match model (768 for `text-embedding-004`) |
| `QDRANT_URL`                                       | for RAG                   | e.g. `http://localhost:6333`                    |
| `QDRANT_API_KEY`                                   | if Qdrant Cloud           | API key                                         |
| `QDRANT_COLLECTION`                                | no                        | Default `inkloom_chunks`                        |
| `MAX_FILE_SIZE`                                    | no                        | Bytes, default 10MB                             |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | **yes for file uploads** | Server-only Cloudinary credentials |
| `CHUNK_SIZE` / `CHUNK_OVERLAP` / `RETRIEVAL_COUNT` | no                        | RAG tuning                                      |
| `LLM_TIMEOUT_MS` / `LLM_MAX_RETRIES`               | no                        | Provider timeouts / retries                     |

Never commit real secrets. `.env` is gitignored.

### Cloudinary and production uploads

Create a Cloudinary account and set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` in `server/.env`. Add the same three variables to the backend hosting provider's environment settings (for Vercel, the server project settings); never add them to `client/.env` or any `VITE_*` variable. Configure `CLIENT_URL` to the exact deployed frontend origin. Multiple comma-separated origins are supported for staged deployments.

Uploads use authenticated Cloudinary raw assets and the server's in-memory Multer buffer. The default maximum is 10 MiB (`MAX_FILE_SIZE`); keep it within the chosen host's request/body limits. Vercel's server function has a 300-second maximum duration configured, but platform request size limits still apply. Larger upload requirements need signed direct-to-Cloudinary uploads with a server-authorized signature endpoint. MongoDB stores the Cloudinary public ID and metadata; PDF/text extraction and RAG indexing continue using the validated request buffer. Existing local-storage records cannot be moved automatically and must be re-uploaded if their original local files are no longer present.

## Database setup

1. Start MongoDB locally (`mongod`) or create an Atlas cluster.
2. Set `MONGODB_URI` (example: `mongodb://127.0.0.1:27017/inkloom`).
3. The API creates collections and indexes on first run.

## Qdrant setup

Local Docker:

```bash
docker run -p 6333:6333 -p 6334:6334 qdrant/qdrant
```

Then set:

```
QDRANT_URL=http://localhost:6333
QDRANT_COLLECTION=inkloom_chunks
EMBEDDING_MODEL=text-embedding-004
EMBEDDING_DIMENSIONS=768
GEMINI_API_KEY=your_google_ai_key
```

The server creates the collection with the configured vector size if it does not exist. **Dimensions must match the embedding model.** Re-create the collection if you change models.

## Demo seeding

Creates the synthetic **NovaPay Digital** workspace, four role users, brand knowledge, and sample drafts. Safe to re-run (upserts by email / workspace slug).

```bash
cd server
npm run seed
```

Demo logins (synthetic data, not a real company):

| Role     | Email                   | Password            |
| -------- | ----------------------- | ------------------- |
| ADMIN    | `admin@novapay.demo`    | `NovaPay!Admin1`    |
| CREATOR  | `creator@novapay.demo`  | `NovaPay!Creator1`  |
| MANAGER  | `manager@novapay.demo`  | `NovaPay!Manager1`  |
| REVIEWER | `reviewer@novapay.demo` | `NovaPay!Reviewer1` |

Seeded drafts include correct terminology, discouraged variants (`Nova Pay`), unsupported claims, a compliant draft, and a high-risk draft that requires human review.

If Groq/Gemini and Qdrant are configured, seed **runs the real review pipeline** on sample drafts. If they are not, seed still writes MongoDB records and prints a clear skip message.

## Development commands

```bash
# Terminal 1 — API
cd server
npm run dev

# Terminal 2 — UI
cd client
npm run dev
```

Open `http://localhost:5173`. The Vite proxy forwards `/api` to the Express server.

Production-style API start:

```bash
cd server
npm start
```

Client build:

```bash
cd client
npm run build
```

## Test commands

```bash
cd server
npm test
```

Tests cover authentication, authorization / workspace isolation, workflow transitions, audit events, file validation, citation validation, RAG empty/inactive source cases, and LLM provider fallback (mocked providers — no paid API required).

## API documentation

Base URL: `http://localhost:5000/api`

Send `Authorization: Bearer <token>` after login. Send `X-Workspace-Id: <id>` for workspace-scoped routes.

### Auth

- `POST /api/auth/register` `{ name, email, password, workspaceName? }`
- `POST /api/auth/login` `{ email, password }`
- `GET /api/auth/me`

### Workspaces

- `GET /api/workspaces`
- `POST /api/workspaces` `{ name }`
- `GET /api/workspaces/:workspaceId`
- `PATCH /api/workspaces/:workspaceId` brand voice / settings (admin)
- `GET /api/workspaces/:workspaceId/members`
- `POST /api/workspaces/:workspaceId/members` `{ email, role }`
- `PATCH /api/workspaces/:workspaceId/members/:memberId` `{ role }`
- `DELETE /api/workspaces/:workspaceId/members/:memberId`

### Knowledge base

- `GET /api/sources`
- `POST /api/sources/upload` multipart `file` + `name` + optional `reindex`
- `GET /api/sources/:id`
- `POST /api/sources/:id/reindex`
- `PATCH /api/sources/:id` approval / active version
- `DELETE /api/sources/:id`
- `GET /api/sources/:id/download` (authorized)

### Rules, terminology, claims, assets, brand voice

- `GET|POST /api/rules` · `PUT|DELETE /api/rules/:id`
- `GET|POST /api/terminology` · `PUT|DELETE /api/terminology/:id`
- `GET|POST /api/claims` · `PUT|DELETE /api/claims/:id`
- `GET|POST /api/assets` · `DELETE /api/assets/:id`
- Brand voice is stored on the workspace (`PATCH /api/workspaces/:id`)

### Drafts and reviews

- `GET|POST /api/drafts` · `GET|PUT /api/drafts/:id`
- `GET /api/drafts/:id/revisions`
- `POST /api/reviews` `{ draftId }`
- `GET /api/reviews/:id`
- `POST /api/reviews/:id/rerun`
- `GET /api/drafts/:id/findings`
- `PATCH /api/findings/:id` `{ status, reason, editedSuggestion }`
- `POST /api/findings/:id/escalate`

### Workflow

- `POST /api/drafts/:id/submit`
- `POST /api/drafts/:id/comments` `{ body }`
- `POST /api/drafts/:id/assign` `{ reviewerId }`
- `POST /api/drafts/:id/request-changes` `{ reason }`
- `POST /api/drafts/:id/approve` `{ reason? }`
- `POST /api/drafts/:id/reject` `{ reason }`

### Analytics and audit

- `GET /api/analytics/overview?from=&to=`
- `GET /api/analytics/findings?from=&to=`
- `GET /api/audit-logs`

## Verified working features

Implemented in this codebase:

- Registration, login, JWT, hashed passwords, protected routes
- Workspaces, membership, RBAC
- Dashboard overview from MongoDB aggregations
- Brand sources (PDF/text upload, extract, versioning, reindex)
- Rules, terminology, approved claims, brand voice, assets
- Deterministic checks (product names, prohibited terms, expired claims, absolute phrases, disclaimers)
- LangChain RAG review with Groq → Gemini fallback and Zod-validated findings
- Qdrant indexing with workspace / approval / active-version filters
- Citation verification against retrieved chunks
- Review UI: filters, accept / edit / dismiss / escalate / resolve
- Revisions without overwriting original content
- Human workflow: submit, comments, assign, request changes, approve, reject
- Audit logs
- Analytics (severity, category, terminology, turnaround)
- Demo seed (NovaPay Digital)
- Automated tests (auth, RBAC, isolation, workflow, files, RAG helpers, providers)

## Remaining limitations

- Visual PDF analysis (logos, colors, layout) is **not** implemented. PDF review uses extracted text only.
- There is no auto-publish / CMS push. Approval is the terminal content state.
- Embedding uses Google Generative AI; Groq does not replace embeddings.
- LLM quality depends on your keys, models, and retrieved evidence. Empty retrieval yields **Needs Verification**, not invented sources.
- Qdrant and MongoDB must be reachable for full RAG; without them, indexing and semantic review fail with explicit errors.
- Package versions should be re-checked against provider docs when you upgrade models.

## License

Private / project use. Demo content is synthetic.
