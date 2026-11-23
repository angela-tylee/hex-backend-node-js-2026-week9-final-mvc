# Refactor backend/ into MVC + Service/Repository folders (minimal-change move)

## Context
Every file in [backend/routes/](backend/routes/) mixes URL wiring, request handling, SQL and helpers. [adminCoach.js](backend/routes/adminCoach.js) alone is 508 lines and contains 25 queries. The goal is to **move existing code blocks into the right layer folders with as few edits as possible**, following the Controller → Service → Repository concept (reference: https://ithelp.ithome.com.tw/articles/10296870; the page returned 403 to the fetcher, so the layer names follow the standard pattern).

Out of scope for now, to keep the diff minimal:
- No removal of try/catch (Express v5 async error handling is deferred).
- No AppError or throw-based errors. `return res.status(400).json(...)` stays as is.
- No change to the error handler, response shapes, messages, check order or route order.

## Where does `db/` go?
`db/` becomes **neither** a service nor a repository. It stays as the **infrastructure layer**: [pool.js](backend/db/pool.js) (connection pool, `waitForDatabase`) and [schema.js](backend/db/schema.js) (`ensureSchema`), both unchanged. The SQL that is inline in the route files today moves into the new **`repositories/`** layer. After the refactor, only `repositories/`, `db/` and the healthcheck repository import `pool`.

```
routes → controllers → services (business helpers) → repositories (SQL) → db (pool)
                  └──────────────→ repositories (for simple CRUD, no service needed)
```

## Target layout
```
backend/
  app.js, bin/www.js, config/   # unchanged (app.js still requires ./routes/*)
  db/pool.js, db/schema.js      # unchanged: infrastructure
  routes/*.js                   # SAME filenames & mount paths; keep only router + middleware + controller refs
  controllers/                  # handler bodies moved VERBATIM from routes (incl. try/catch)
    healthcheckController.js skillController.js creditPackageController.js
    userController.js adminCoachController.js coachController.js courseController.js
  services/                     # business helpers lifted verbatim out of route files
    creditService.js            # remaining credits = Σpurchased − active bookings (dup in course.js & user.js)
    revenueService.js           # MONTH_NAMES, month range, per-credit price + floor rule (adminCoach.js:376-430)
    coachSkillService.js        # getSkillIds (adminCoach.js:17)
  repositories/                 # each inline pool.query/client.query → one named function, SQL text unchanged
    skillRepository.js creditPackageRepository.js creditPurchaseRepository.js
    userRepository.js coachRepository.js courseRepository.js courseBookingRepository.js
  middlewares/auth.js           # only change: users lookup → userRepository.findAuthById
  utils/validators.js           # + validateCourseBody (adminCoach.js:30), parseNonNegativeInt (coach.js:12)
  utils/serializers.js          # NEW: serializeCourse (adminCoach.js:58)
  utils/messages.js             # NEW: FIELD_ERROR, COACH_NOT_FOUND (moved; values unchanged)
```

## Move rules (the only edits allowed)
1. **Route → controller.** Cut each `async (req, res, next) => { … }` body from `routes/X.js` into `controllers/XController.js` as `exports.name = async (req, res, next) => { …same body… }`. The route line becomes `router.get('/', authenticate, requireCoach, adminCoachController.getProfile)`, with the middleware chain unchanged.
2. **SQL → repository.** Replace each query call with a repository call that **returns the raw `pg` result**, so the code around it (`rows`, `rowCount`, `rows[0]`) does not change:
   ```js
   // before (controller)
   const dup = await pool.query('SELECT id FROM skill WHERE name = $1', [trimmed])
   // after
   const dup = await skillRepository.findIdByName(trimmed)

   // repositories/skillRepository.js
   exports.findIdByName = (name, db = pool) =>
     db.query('SELECT id FROM skill WHERE name = $1', [name])
   ```
   The optional `db = pool` parameter lets the 3 transactional handlers pass `client` (`courseBookingRepository.insert(userId, courseId, client)`). Their `pool.connect()`, BEGIN/COMMIT/ROLLBACK and `client.release()` lines stay in the controller unchanged:
   - `PUT /api/admin/coaches`
   - `POST /api/admin/coaches/:userId`
   - `POST /api/courses/:courseId`

   This is the one place a controller still imports `pool`.
3. **Helpers → services/utils.** Move the helper functions and constants verbatim and replace them with `require`s. For `creditService` and `revenueService`, the controller's inline computation block becomes one call that returns the same variables (for example `const creditRemain = await creditService.getCreditRemain(req.user.id, client)`).
4. **Keep inline comments** (for example the ①②③④ check-order notes) with the code they describe.

## Execution: one small move per step, committed by the user
Each step moves exactly one kind of block (SQL, then handlers, then helpers) for one resource. **Claude never runs `git commit` or `git push`.** After each step Claude:

1. makes the edits and ticks the step `- [x]` here;
2. runs the listed checks and reports the results;
3. stops, leaving the changes **uncommitted**, and suggests a commit message (conventional-commits subject plus a short body).

The user reviews the diff (`git diff`), commits, and then asks for the next step. The listed test suite should pass before the user commits.

**Phase 0: Baseline**
- [x] 0.1 `git init`, check that `.gitignore` covers `node_modules` and `.env`, commit the untouched project. Suggested subject: `chore: initial commit of week9 final project`

**Phase 1: Scaffolding (no behavior change)**
- [x] 1.1 Create `controllers/`, `services/` and `repositories/`, each with a `.gitkeep` (git doesn't track empty folders). Suggested subject: `chore(backend): scaffold controllers, services, repositories folders`
- [x] 1.2 Move the shared constants and helpers verbatim, and switch the route files to `require` them:
  - `FIELD_ERROR` and `COACH_NOT_FOUND` → `utils/messages.js`
  - `validateCourseBody` and `parseNonNegativeInt` → `utils/validators.js`
  - `serializeCourse` → `utils/serializers.js`

  Run `npm test`, then stop for the user to review and commit. Suggested subject: `refactor(backend): move shared constants and helpers into utils`

**Phase 2: M0/M1 (healthcheck, skill, credit package)**
- [x] 2.1 SQL → `repositories/skillRepository.js`, `creditPackageRepository.js`, `creditPurchaseRepository.js` (the purchase INSERT). Healthcheck's `SELECT 1` stays as `pool.query` in its controller, because it is an infrastructure ping. Run `test:smoke` and `test:m1`, then stop for the user to review and commit. Suggested subject: `refactor(backend): extract skill and credit-package SQL into repositories`
- [ ] 2.2 Handlers → `controllers/healthcheckController.js`, `skillController.js`, `creditPackageController.js`; the routes keep only wiring. Run `test:smoke`, `test:m1` and `test:m5` (purchase), then stop for the user to review and commit. Suggested subject: `refactor(backend): move skill and credit-package handlers into controllers`

**Phase 3: M2 (user)**
- [ ] 3.1 user.js SQL → `userRepository.js`; user credit and booking queries → `creditPurchaseRepository` and `courseBookingRepository`. Run `test:m2` and `test:m5`, then stop for the user to review and commit.
- [ ] 3.2 user handlers → `userController.js`. Run `test:m2` and `test:m5`, then stop for the user to review and commit.
- [ ] 3.3 `middlewares/auth.js` users lookup → `userRepository.findAuthById`. Run `npm test`, then stop for the user to review and commit.

**Phase 4: M3/M6 (admin coach, the largest file)**
- [ ] 4.1 adminCoach.js SQL → `coachRepository.js` and `courseRepository.js`, with the transaction `client` passed through. Run `test:m3` and `test:m6`, then stop for the user to review and commit.
- [ ] 4.2 `getSkillIds` → `services/coachSkillService.js`. Run `test:m3`, then stop for the user to review and commit.
- [ ] 4.3 Revenue month range, per-credit price and floor rule → `services/revenueService.js`. Run `test:m6`, then stop for the user to review and commit.
- [ ] 4.4 adminCoach handlers → `adminCoachController.js`, keeping the route order (`POST /:userId` last). Run `test:m3` and `test:m6`, then stop for the user to review and commit.

**Phase 5: M4/M5 (public coach, courses, booking)**
- [ ] 5.1 coach.js and course.js SQL → `coachRepository`, `courseRepository` and `courseBookingRepository`. Run `test:m4` and `test:m5`, then stop for the user to review and commit.
- [ ] 5.2 Duplicated remaining-credits block (course.js and user.js) → `services/creditService.getCreditRemain(userId, db)`. Run `test:m5`, then stop for the user to review and commit.
- [ ] 5.3 coach and course handlers → `coachController.js` and `courseController.js`. Run `test:m4` and `test:m5`, then stop for the user to review and commit.

**Phase 6: Cleanup**
- [ ] 6.1 Remove `.gitkeep` files from folders that now have content, and remove any `pool` imports that are no longer used. Run the grep checks below and the full `npm test`, then stop for the user to review and commit. Suggested subject: `chore(backend): remove placeholders and unused imports`

## Verification
1. Run `npm run db:reset`, then `npm --prefix backend run dev` (server on :8080).
2. From the repo root, run `npm test`. All smoke and M1–M6 suites (black-box HTTP contract tests in [test/](test/)) must pass unchanged.
3. Run `grep -rn "pool.query" backend/routes backend/controllers backend/services`. It should return nothing. `pool.connect` should appear only in the 3 transactional controllers.
4. Run `grep -rn "require('../db/pool')" backend/routes`. It should return nothing, since routes only wire controllers.
