const fs = require("fs");
const path = require("path");
const { getObject } = require("../lib/objects");

function readHeadAt(repoDir) {
  const headFile = path.join(repoDir, ".bit", "HEAD");
  if (!fs.existsSync(headFile))
    throw new Error(`clone: HEAD not found in ${repoDir}`);
  const headRaw = fs.readFileSync(headFile, "utf8").trim();
  if (headRaw.startsWith("ref:")) {
    const ref = headRaw.slice(4).trim();
    const refFile = path.join(repoDir, ".bit", ...ref.split("/"));
    if (!fs.existsSync(refFile)) return null;
    return fs.readFileSync(refFile, "utf8").trim() || null;
  }
  return headRaw || null;
}

function readCommitAt(repoDir, hash) {
  const objFile = path.join(repoDir, ".bit", "objects", hash);
  if (!fs.existsSync(objFile)) return null;
  const raw = fs.readFileSync(objFile, "utf8");
  try {
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function writeTreeToWork(tree, destDir) {
  for (const rel of Object.keys(tree || {})) {
    const abs = path.join(destDir, rel.split("/").join(path.sep));
    ensureDir(path.dirname(abs));
    // Read object from DEST repo's store (we copied .bit next)
    // However, since we copied .bit entirely, we can construct path directly
    // Use getObject after adjusting cwd? Simpler: read from dest .bit/objects
    // But getObject uses process.cwd; so instead, read directly from dest objects
    // The commit tree contains hashes; the object files are under dest/.bit/objects/xx/yy...
    const hash = tree[rel];
    const objDir = path.join(destDir, ".bit", "objects", hash.slice(0, 2));
    const objFile = path.join(objDir, hash.slice(2));
    if (!fs.existsSync(objFile))
      throw new Error(`clone: missing object ${hash}`);
    const data = fs.readFileSync(objFile);
    fs.writeFileSync(abs, data);
  }
}

module.exports = function clone(srcPath, destPath) {
  if (!srcPath || !destPath)
    throw new Error("clone: source and destination are required");
  const absSrc = path.resolve(process.cwd(), srcPath);
  const absDest = path.resolve(process.cwd(), destPath);

  if (!fs.existsSync(path.join(absSrc, ".bit"))) {
    throw new Error(`clone: ${absSrc} does not appear to be a bit repository`);
  }
  ensureDir(absDest);
  // Copy .bit directory recursively
  fs.cpSync(path.join(absSrc, ".bit"), path.join(absDest, ".bit"), {
    recursive: true,
  });

  // Checkout HEAD tree into working directory
  const head = readHeadAt(absDest);
  if (!head) {
    console.log(`Cloned empty repository into ${absDest}`);
    return;
  }
  const commit = readCommitAt(absDest, head);
  if (!commit || !commit.tree) {
    console.log(`Cloned repository into ${absDest} (no tree to checkout)`);
    return;
  }
  writeTreeToWork(commit.tree, absDest);
  console.log(`Cloned repository into ${absDest}`);
};
