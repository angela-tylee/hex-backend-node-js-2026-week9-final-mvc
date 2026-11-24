# Port backend/ to ASP.NET Core (learning project)

## Context
Goal: get hands-on with .NET project structure by re-implementing the existing Express backend ([backend/](backend/)) in ASP.NET Core, without breaking the working Node version.

The repo is well suited to this:
- [test/*.test.js](test/) are **black-box HTTP contract tests** (Jest + supertest against `http://localhost:8080`, see [test/helpers.js](test/helpers.js)). They don't touch code or DB, so they work as an acceptance suite for the .NET port unchanged.
- [docs/openapi.yaml](docs/openapi.yaml) + the finished frontend define the contract.
- The backend was just layered (routes → controllers → services → repositories → db, see [REFACTOR_MVC.md](REFACTOR_MVC.md)), which maps nearly 1:1 to ASP.NET Core.

Decisions (from user):
- **Phase 1 (now):** single Web API project, **Dapper + Npgsql**, reusing the existing SQL from `repositories/*.js` nearly verbatim.
- **Phase 2 (advanced, later):** move to **EF Core**, then split into **multi-project** (Api / Core / Infrastructure).

Out of scope: changing the Node backend, tests, frontend, or OpenAPI spec.

## Target layout (Phase 1)
```
backend-dotnet/
  FitnessApi.sln
  FitnessApi/
    FitnessApi.csproj            # net9/10 web SDK; Npgsql, Dapper, BCrypt.Net-Next, Microsoft.AspNetCore.Authentication.JwtBearer
    Program.cs                   # ← bin/www.js + app.js: config, DI, CORS, auth, middleware, MapControllers, 404 fallback, ensureSchema on startup
    appsettings.json             # defaults; env vars (PORT, DB_*, JWT_*) override
    Options/DbOptions.cs, JwtOptions.cs          # ← config/index.js (IOptions<T>, fail fast on missing keys)
    Infrastructure/DbConnectionFactory.cs        # ← db/pool.js (+ waitForDatabase retry)
    Infrastructure/SchemaInitializer.cs          # ← db/schema.js (same CREATE ... IF NOT EXISTS SQL)
    Repositories/*Repository.cs                  # ← repositories/*.js (SQL copied, Dapper QueryAsync/ExecuteAsync)
    Services/CreditService.cs, RevenueService.cs, CoachSkillService.cs   # ← services/*.js
    Controllers/*Controller.cs                   # ← routes/*.js + controllers/*.js (attribute routing)
    Dtos/Requests/*.cs, Dtos/Responses/*.cs      # ← utils/validators.js + utils/serializers.js
    Auth/JwtService.cs                           # ← utils/jwt.js
    Auth/AuthenticateFilter.cs, RequireCoachFilter.cs   # ← middlewares/auth.js
    Common/ApiResponse.cs, ApiException.cs, ErrorHandlingMiddleware.cs   # {status:'success'|'failed'} envelope
    Common/Messages.cs                           # ← utils/messages.js
    Dockerfile, .dockerignore
```

## Key mapping rules (things that will bite)
1. **Response envelope is the contract.** Every reply is `{ status: 'success' | 'failed', ... }`. Disable ASP.NET's automatic ProblemDetails/400s (`SuppressModelStateInvalidFilter = true` or a custom `InvalidModelStateResponseFactory`), map all exceptions to `{status:'failed', message}` in `ErrorHandlingMiddleware`, and use `app.MapFallback` for the `找不到此路由` 404. Keep JSON in camelCase/snake_case exactly as the serializers produce now.
2. **Auth must reproduce the exact messages in [middlewares/auth.js](backend/middlewares/auth.js):** `請先登入`, `Token 已過期`, `無效的 token` (all 401), plus the DB lookup of the user. `requireCoach` returns **401** `使用者尚未成為教練`, not 403. Simplest faithful approach: custom `IAsyncActionFilter`s (`[Authenticate]`, `[RequireCoach]`) using `JwtSecurityTokenHandler`/`JsonWebTokenHandler` directly, and store the user in `HttpContext.Items`. (The built-in `AddJwtBearer` + `OnChallenge` events are a Phase 2 exercise.)
3. **Per-route guards must match** [routes/adminCoach.js](backend/routes/adminCoach.js): `GET/PUT /courses/:courseId` are authenticate-only, `POST /:userId` is public, and the rest need authenticate + requireCoach.
4. **JWT compatibility:** HS256 with the same `JWT_SECRET`, claims `id` and `role` (payload as in [utils/jwt.js](backend/utils/jwt.js)). Parse `JWT_EXPIRES_DAY` in `ms` format (`30d`) with a small helper.
5. **Passwords:** `BCrypt.Net-Next` verifies existing bcryptjs hashes and produces compatible ones.
6. **Route ordering:** in Express, `/api/coaches/skill` has to be mounted before `/:coachId`. ASP.NET routing ranks literal segments above parameters automatically, so ordering doesn't matter. Use route constraints (`{coachId:guid}`?) only if they match how the Node version validates IDs.
7. **Validation order and messages:** port [utils/validators.js](backend/utils/validators.js) as explicit checks in the controller/service, in the same order, rather than DataAnnotations. Tests assert specific failure messages and statuses.

## Milestone-by-milestone steps
- [ ] 0. Scaffold: `dotnet new sln`, `dotnet new webapi --use-controllers`, add packages, Program.cs wiring, Options, DbConnectionFactory, SchemaInitializer, envelope + error middleware, 404 fallback, `GET /healthcheck`. Verify: `npm run test:smoke`.
- [ ] 1. M1: `SkillController` (`/api/coaches/skill`), `CreditPackageController` list/create/delete. Verify: `npm run test:m1`.
- [ ] 2. M2: JwtService, AuthenticateFilter, `UsersController` signup/login/profile/password. Verify: `npm run test:m2`.
- [ ] 3. M3: RequireCoachFilter, `AdminCoachesController` (upgrade, profile, courses), CoachSkillService. Verify: `npm run test:m3`.
- [ ] 4. M4: `CoachesController` and `CoursesController` list (public). Verify: `npm run test:m4`.
- [ ] 5. M5: purchase credit package, booking/cancel, CreditService, user credit-package/courses. Verify: `npm run test:m5`.
- [ ] 6. M6: revenue (RevenueService: month range, per-credit price, floor rule). Verify: `npm run test:m6`.
- [ ] 7. Docker: multi-stage Dockerfile (sdk → aspnet runtime), listen on `PORT`, healthcheck via `curl`/`wget` (the Node healthcheck in compose uses `node -e`, so this needs an override). Verify by pointing the compose `backend` build context at `./backend-dotnet` locally.

## Phase 2 (advanced, later)
- [ ] Replace Dapper repositories with an EF Core `DbContext` + entities, keeping the repository interfaces so controllers and services don't change. Replace SchemaInitializer with migrations (watch: the existing `uuid_generate_v4()` defaults and CHECK constraints).
- [ ] Split into `FitnessApi.Api` / `FitnessApi.Core` (services, interfaces, domain) / `FitnessApi.Infrastructure` (EF, JWT, DB).
- [ ] Optional: `AddJwtBearer` with custom `OnChallenge`/`OnTokenValidated` events, and an xUnit project with `WebApplicationFactory`.

## Verification
1. `docker compose up -d postgres` (fresh DB: `npm run db:reset`).
2. `cd backend-dotnet/FitnessApi && PORT=8080 DB_HOST=localhost DB_USERNAME=student DB_PASSWORD=student666 DB_DATABASE=fitness JWT_SECRET=... dotnet run`.
3. From the repo root: `npm test` (all of M1–M6 + smoke must pass, unchanged).
4. Manual: `docker compose up frontend swagger` and click through the frontend at :3000; use Try-it-out in Swagger at :8081.
5. Regression: stop .NET, start Node (`npm --prefix backend start`), and run `npm test` again. Both implementations should pass the same suite.

No commits: leave the changes uncommitted and suggest commit messages per milestone.
