import { createClient } from "@meshql/client";

const client = createClient({
  url: "http://localhost:3001/mesh",
});

const data = await client.query({
  user: {
    id: true,
    name: true,
    tokens: {
      accessToken: true,
      expiresAt: true,
    },
  },
}, { entityId: "1" });

console.log(JSON.stringify(data, null, 2));
