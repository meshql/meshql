---
title: "I wanted GraphQL's superpower without GraphQL's personality disorder"
published: false
tags: typescript, node, api, graphql, sql, webdev, opensource
series: MeshQL
canonical_url: https://github.com/meshql/meshql
cover_image: https://raw.githubusercontent.com/meshql/meshql/main/assets/meshql-logo.png
---

So I built **MeshQL**.

It's a small TypeScript library that lets clients say *"give me these fields, nested like this"* - over normal REST - while you keep writing SQL (or Prisma, or Drizzle, or Kysely) like a person who still enjoys weekends.

Tagline on the tin: **Shape your API, not your codebase.**

- Repo: [github.com/meshql/meshql](https://github.com/meshql/meshql)
- Docs: [docs.meshql.dev](https://docs.meshql.dev)
- Site: [meshql.dev](https://meshql.dev)

---

## The problem nobody admits at standup

**REST** is fine until every frontend wants a different `?include=` and you accidentally ship half the database in JSON because someone asked for `user.posts.comments.author.avatar.url`.

**GraphQL** fixes that - and then invoices you for:

- 47 resolvers
- N+1 archaeology
- Codegen that eats your types and burps `Maybe<T>` at 2am

What I actually wanted was the **middle**:

> Normal URLs. Query in headers. One handler per entity. SQL I already know how to write.

That's MeshQL.

---

## What it does (without the enterprise keynote voice)

1. Client sends a **field selection** - JSON or a little QL syntax - in `X-Mesh-Query`.
2. MeshQL parses it and builds a **JoinPlan**: exactly the fields and joins the client asked for. No over-fetching guilt trip.
3. **Your resolver** runs one query (SQL, Prisma `findMany`, whatever).
4. MeshQL **shapes** flat SQL rows into nested JSON.

No resolver per field. No dataloader yoga. No "quick sync, I just need to regenerate the schema real quick" (famous last words).

---

## A tiny example

Schema:

```typescript
const schema = {
  entities: {
    user: { fields: ["id", "name"], table: "users" },
    token: {
      fields: ["accessToken"],
      table: "tokens",
      columns: { accessToken: "access_token" },
    },
  },
  joins: {
    "user.tokens": {
      entity: "token",
      on: "tokens.user_id = users.id",
      type: "many",
    },
  },
};
```

Client query (conceptually):

```json
{
  "user": {
    "id": true,
    "name": true,
    "tokens": { "accessToken": true }
  }
}
```

Your resolver gets a plan that says *only* fetch those fields. Return flat rows:

```typescript
{ user_id: 1, user_name: "Ada", tokens_accessToken: "tok_ada" }
```

MeshQL hands the client:

```json
{
  "id": 1,
  "name": "Ada",
  "tokens": [{ "accessToken": "tok_ada" }]
}
```

Still REST. Still one `GET /mesh/user/1`. Still your Express/Fastify/Hono app. The client just stops bullying your backend into bespoke DTOs.

---

## "But I use Prisma and I'm emotionally attached"

Same. We just shipped **v0.6.0** with ORM adapters:

| You | One line |
|-----|----------|
| Prisma | `withPrisma(mesh, prisma, { schema })` |
| Drizzle | `withDrizzle(mesh, db, { schema })` |
| Kysely | `withKysely(mesh, db, { schema, dialect: "postgres" })` |
| Raw SQL enjoyers | `buildSelectSql(plan, schema)` + your pool |

Catch-all resolver pattern:

```typescript
mesh.resolve("*", async (plan) => {
  // plan.fields and plan.joins = only what the client asked for
});
```

Prisma example app in the repo: [express-prisma](https://github.com/meshql/meshql/tree/main/examples/express-prisma).

---

## Hot take: MeshQL does NOT want your database password

This confused me at first, so I'll save you the trip:

**MeshQL doesn't create or pool connections.**

You create `PrismaClient` / `pg.Pool` / `DatabaseSync` once at startup. You pass it into the resolver. MeshQL plans queries and shapes JSON. Connection lifecycle stays *your* problem - which is actually what you want in production anyway.

Docs: [Database connections](https://docs.meshql.dev/guide/database-connections)

---

## What's in the box

Published on **[JSR](https://jsr.io/@meshql)** (`@meshql/*`) and **npm** (`meshql-*`):

- `@meshql/core` - parser, planner, shaper
- `@meshql/postgres` / `@meshql/sqlite` - parameterized SQL builders
- `@meshql/prisma` / `@meshql/drizzle` / `@meshql/kysely` - ORM adapters (new in 0.6.0)
- `@meshql/http` - Express, Fastify, Hono
- `@meshql/client` - typed client for Node + browser
- `@meshql/integrity` + `@meshql/access` - signing & field/row access (optional, for when paranoia is a feature)

Install the core stack:

```bash
# JSR
npx jsr add @meshql/core @meshql/http @meshql/client

# npm
npm install meshql-core meshql-http meshql-client
```

Prisma path:

```bash
npx jsr add @meshql/core @meshql/prisma @meshql/http
```

---

## Who is this for?

**Probably you if:**

- You like SQL (or your ORM) and dislike resolver mazes
- Your mobile/web clients keep asking for different field shapes
- You want GraphQL-style selection without standing up GraphQL

**Probably not you if:**

- You need a full mutation/subscription graph with a federated supergraph and a committee
- You want the framework to own your DB pool (try something else; we're not fighting for that job)

---

## Try it in five minutes

Full walkthrough: [docs.meshql.dev/guide/run-example](https://docs.meshql.dev/guide/run-example)

Or clone the **showcase** - React + SQLite, no Docker, actual signed requests in DevTools:

```bash
git clone https://github.com/meshql/meshql.git
cd meshql && pnpm install && pnpm build
pnpm --filter showcase start
# http://localhost:3010
```

---

## Why I built it

Honestly? I got tired of choosing between:

1. **Shipping bloated REST**, and
2. **Adopting GraphQL** and suddenly my side project needed a platform team.

MeshQL is the "what if the client shaped the response, but I kept my stack boring" experiment. It's MIT, Node 22+, works on Bun/Deno, and I'm using it for real APIs - not as a thought experiment that dies in a `packages/` folder (we've all been there).

If you try it and something feels off, open an issue. If you try it and it clicks, I'd love to hear what you built.

**Links:**

- GitHub: [meshql/meshql](https://github.com/meshql/meshql)
- Docs: [docs.meshql.dev](https://docs.meshql.dev)
- Prisma demo: [express-prisma](https://github.com/meshql/meshql/tree/main/examples/express-prisma)

---

*P.S. - Yes, the name is a pun. No, I won't apologize. Yes, `post.comments.author.name` works end-to-end now. We fixed that before the ORM release because nested reads that don't actually read are a special kind of betrayal.*
