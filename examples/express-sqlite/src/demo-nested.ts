import { createClient } from "@meshql/client";

const client = createClient({
  url: "http://localhost:3003/mesh",
});

// Every user, their top 5 posts by score, and each post's last 10
// comments grouped by day. The $orderBy / $page / $groupBy on `posts` and
// `comments` apply per parent row, and it all runs as one SQL statement.
const data = await client.query({
  user: {
    $select: {
      id: true,
      name: true,
      posts: {
        $select: {
          id: true,
          title: true,
          score: true,
          comments: {
            $select: { id: true, createdAt: true, author: { $select: { name: true } } },
            $orderBy: [{ field: "createdAt", direction: "desc" }],
            $page: { first: 10 },
            $groupBy: [{ field: "createdAt", bucket: "day", as: "date" }],
            $aggregate: { count: { fn: "count", field: "*" } },
          },
        },
        $orderBy: [{ field: "score", direction: "desc" }],
        $page: { first: 5 },
      },
    },
    $page: { first: 20 },
  },
});

console.log(JSON.stringify(data, null, 2));
