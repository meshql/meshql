import { createClient } from "@meshql/client";

const BASE = process.env.API_URL ?? "http://localhost:3020/api";

async function main() {
  const client = createClient({ url: BASE });

  const post = await client.query(
    {
      post: {
        $select: {
          id: true,
          title: true,
          author: { $select: { name: true } },
          comments: {
            $select: {
              body: true,
              author: { $select: { name: true } },
            },
          },
        },
      },
    },
    { entityId: "1" },
  );

  console.log(JSON.stringify(post, null, 2));
}

main().catch((error) => {
  console.error("Demo failed — is the server running?");
  console.error("  pnpm --filter express-prisma db:push");
  console.error("  pnpm --filter express-prisma start\n");
  console.error(error);
  process.exit(1);
});
