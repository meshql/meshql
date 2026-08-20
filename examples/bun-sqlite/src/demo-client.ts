import { createClient } from "@meshql/client";

const port = Number(process.env.PORT ?? 3004);
const client = createClient({
  url: `http://localhost:${port}/mesh`,
});

const data = await client.query(
  {
    user: {
      $select: {
        id: true,
        name: true,
        tokens: {
          $select: { accessToken: true },
        },
      },
    },
  },
  { entityId: "1" },
);

console.log(JSON.stringify(data, null, 2));
