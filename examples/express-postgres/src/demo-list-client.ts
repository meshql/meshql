import { createClient } from "@meshql/client";

const client = createClient({
  url: "http://localhost:3001/mesh",
});

const users = await client.query(
  {
    user: {
      id: true,
      name: true,
      tokens: {
        accessToken: true,
      },
    },
  },
  {
    page: { first: 10 },
    orderBy: [{ field: "name", direction: "asc" }],
  },
);

console.log(JSON.stringify(users, null, 2));
