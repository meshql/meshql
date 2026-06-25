import { createClient } from "@meshql/client";

const client = createClient({
  url: "http://localhost:3003/mesh",
});
console.log("time start", new Date().toISOString());
const data = await client.query(
  {
    user: {
      id: true,
      name: true,
      tokens: {
        accessToken: true,
      },
    },
  },
  { entityId: "1" },
);
console.log("time end", new Date().toISOString());
console.log(JSON.stringify(data, null, 2));
