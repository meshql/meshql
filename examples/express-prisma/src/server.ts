import { PrismaClient } from "@prisma/client";
import { createMesh } from "@meshql/core";
import { meshExpressRouter } from "@meshql/http/express";
import { withPrisma } from "@meshql/prisma";
import express from "express";
import { schema } from "./schema.js";

const prisma = new PrismaClient();

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

const mesh = createMesh(schema);
withPrisma(mesh, prisma, { schema });

const app = express();
app.use(express.json());
app.use("/api", meshExpressRouter(mesh));

const port = Number(process.env.PORT ?? 3020);

seed()
  .then(() => {
    app.listen(port, () => {
      console.log(`express-prisma listening on http://localhost:${port}/api`);
    });
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
