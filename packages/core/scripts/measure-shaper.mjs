/**
 * Throwaway measurement — confirms the shapeRefMany O(N²) → O(N) rewrite
 * delivers the expected speedup at realistic row counts.
 *
 * Kept as a seed for future shaper perf work. Not wired into CI.
 *
 * Usage (from repo root):
 *   pnpm --filter @meshql/core build
 *   node packages/core/scripts/measure-shaper.mjs
 */
import { performance } from "node:perf_hooks";
import { shape, shapeMany, parseQl } from "../dist/index.js";

function commentsJoin() {
  return {
    path: "comments",
    joinKey: "post.comments",
    entity: "comment",
    on: "comments.post_id = posts.id",
    fields: ["comments.id", "comments.body"],
    type: "many",
    refName: "comments",
    idField: "id",
  };
}

function tagsJoin() {
  return {
    path: "tags",
    joinKey: "post.tags",
    entity: "tag",
    on: "tags.post_id = posts.id",
    fields: ["tags.id", "tags.name"],
    type: "many",
    refName: "tags",
    idField: "id",
  };
}

/**
 * Build a Cartesian dataset: `numParents` × `commentsPerParent` × `tagsPerParent`
 * flat rows, matching what SQL would emit for a two-many-join query.
 */
function buildDataset(numParents, commentsPerParent, tagsPerParent) {
  const rows = [];
  for (let p = 1; p <= numParents; p++) {
    for (let c = 1; c <= commentsPerParent; c++) {
      for (let t = 1; t <= tagsPerParent; t++) {
        rows.push({
          post_id: p,
          comments_id: p * 1000 + c,
          comments_body: `p${p}-c${c}`,
          tags_id: p * 1000 + t,
          tags_name: `p${p}-t${t}`,
        });
      }
    }
  }
  return rows;
}

function measure(label, fn, iterations) {
  // Warmup
  for (let i = 0; i < 5; i++) fn();

  const durations = [];
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    fn();
    durations.push(performance.now() - t0);
  }

  durations.sort((a, b) => a - b);
  const median = durations[Math.floor(durations.length * 0.5)];
  const p95 = durations[Math.floor(durations.length * 0.95)];
  console.log(
    `  ${label.padEnd(60)} median=${median.toFixed(3).padStart(8)}ms  p95=${p95.toFixed(3).padStart(8)}ms`,
  );
}

const scenarios = [
  {
    name: "shape:      1 post ×  10 comments ×  5 tags  =    50 rows",
    parents: 1,
    comments: 10,
    tags: 5,
    iters: 500,
  },
  {
    name: "shape:      1 post ×  50 comments × 10 tags  =   500 rows",
    parents: 1,
    comments: 50,
    tags: 10,
    iters: 200,
  },
  {
    name: "shape:      1 post × 100 comments × 20 tags  =  2000 rows",
    parents: 1,
    comments: 100,
    tags: 20,
    iters: 100,
  },
  {
    name: "shapeMany:  20 posts × 10 comments × 5 tags  =  1000 rows",
    parents: 20,
    comments: 10,
    tags: 5,
    iters: 200,
  },
  {
    name: "shapeMany:  50 posts × 20 comments × 10 tags = 10000 rows",
    parents: 50,
    comments: 20,
    tags: 10,
    iters: 20,
  },
];

const ast = parseQl("{ post { id comments { id body } tags { id name } } }");
const joins = [commentsJoin(), tagsJoin()];

console.log("\nShaper measurement — post-Slice-B (O(N) shapeRefMany)\n");

for (const s of scenarios) {
  const rows = buildDataset(s.parents, s.comments, s.tags);
  const useMany = s.parents > 1;
  const label = s.name;
  if (useMany) {
    measure(label, () => shapeMany(rows, ast.root, joins, "id"), s.iters);
  } else {
    measure(label, () => shape(rows, ast.root, joins), s.iters);
  }
}

console.log("");
