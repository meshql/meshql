import { createClient } from "@meshql/client";

const client = createClient({
  url: "http://localhost:3001/mesh",
});

const data = await client.query({
  user: {
    $select: {
      id: true,
      name: true,
      tokens: {
        $select: {
          accessToken: true,
          expiresAt: true,
        },
      },
    },
  },
}, { entityId: "1" });

console.log(JSON.stringify(data, null, 2));
