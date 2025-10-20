const fs = require("fs");
const path = require("path");
const { readIndex } = require("../lib/repo");
const { getObject } = require("../lib/objects");

// Restore file content from the index (like `git restore --staged/--worktree` simplified)
module.exports = function restore(filePath) {
  if (!filePath) throw new Error("restore: path required");
  const index = readIndex() || {};
  const rel = filePath.split(path.sep).join("/");
  const hash = index[rel];
  if (!hash) throw new Error(`restore: ${rel} is not tracked`);
  const data = getObject(hash);
  const abs = path.resolve(process.cwd(), filePath);
  const dir = path.dirname(abs);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(abs, data);
  console.log(`Restored ${rel}`);
};
