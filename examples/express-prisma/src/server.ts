import { PrismaClient } from "@prisma/client";
import { createMesh } from "@meshql/core";
import { meshExpressRouter } from "@meshql/http/express";
import { schemaFromPrisma, withPrisma } from "@meshql/prisma";
import express from "express";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const prisma = new PrismaClient();
const root = dirname(fileURLToPath(import.meta.url));
const schemaPath = join(root, "../prisma/schema.prisma");

async function seed() {
  const count = await prisma.user.count();
  if (count > 0) {
    return;
  }

  const ada = await prisma.user.create({
    data: {
      name: "Ada Lovelace",
      email: "ada@example.com",
      role: "author",
    },
  });

  const post = await prisma.post.create({
    data: {
      title: "Hello MeshQL",
      body: "Prisma-backed nested reads.",
      status: "published",
      authorId: ada.id,
    },
  });

  await prisma.comment.create({
    data: {
      body: "Great post!",
      postId: post.id,
      authorId: ada.id,
    },
  });

  await prisma.user.create({
    data: {
      name: "Guest",
      email: "guest@example.com",
      role: "guest",
    },
  });

  console.log(`Seeded post #${post.id} by user #${ada.id}`);
}

async function main() {
  const schema = await schemaFromPrisma(schemaPath);
  const mesh = createMesh(schema);
  withPrisma(mesh, prisma, { schema });

  const app = express();
  app.use(express.json());
  app.use("/api", meshExpressRouter(mesh));

  const port = Number(process.env.PORT ?? 3020);

  await seed();
  app.listen(port, () => {
    console.log(`express-prisma listening on http://localhost:${port}/api`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
