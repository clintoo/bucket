"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

/**
 * Load local helper modules (files, config) and fail with a helpful message
 * if they're missing — we ship simple implementations alongside repo.js.
 */
function loadHelper(name) {
  const p = path.join(__dirname, name);
  try {
    return require(p);
  } catch (err) {
    if (err.code === "MODULE_NOT_FOUND") {
      console.error(
        `Missing helper module: ${p}\n` +
          `This repository expects ${name}.js to be present under cli/lib.\n` +
          `Please ensure cli/lib/${name}.js exists.`
      );
    }
    throw err;
  }
}

const files = loadHelper("files");
const config = loadHelper("config");

// Directory used by this toy repo implementation. Keep consistent across project.
const REPO_DIR = ".bit";

// Helper to build paths inside the repository (e.g. /cwd/.bit/objects/...)
function repoPath() {
  const parts = [process.cwd(), REPO_DIR].concat(
    Array.prototype.slice.call(arguments)
  );
  return path.join.apply(path, parts);
}

/**
 * Initialize a new repository.
 * opts:
 *   - bare: boolean (if true, initialize at top-level, not in .bit)
 */
function initRepo(opts) {
  if (files.inRepo()) {
    // already in a repo — no-op
    return;
  }

  opts = opts || {};

  // Create a JS object that mirrors a minimal Git directory structure.
  const repoStructure = {
    HEAD: "ref: refs/heads/main\n",
    config: config.objToStr({ core: { "": { bare: !!opts.bare } } }),
    objects: {},
    refs: {
      heads: {},
    },
  };

  // If bare, place files at top-level; otherwise under .bit
  const tree = opts.bare ? repoStructure : { [REPO_DIR]: repoStructure };
  files.writeFilesFromTree(tree, process.cwd());
}

/**
 * Read HEAD ref
 * Returns commit hash (string) or null if ref not present.
 */
function getHead() {
  const headFile = repoPath("HEAD");
  if (!fs.existsSync(headFile)) {
    throw new Error("Not a repository (HEAD missing): " + headFile);
  }

  const headRaw = fs.readFileSync(headFile, "utf8").trim();

  // If HEAD points to a ref: "ref: refs/heads/main"
  if (headRaw.indexOf("ref:") === 0) {
    const ref = headRaw.slice(4).trim();
    const refParts = ref.split("/"); // e.g. ['refs','heads','main']
    const refFile = repoPath.apply(null, refParts);
    if (!fs.existsSync(refFile)) {
      return null;
    }
    const refVal = fs.readFileSync(refFile, "utf8").trim();
    return refVal || null;
  }

  // Otherwise HEAD contains a hash directly (detached)
  return headRaw || null;
}

/**
 * Write HEAD ref (symbolic or detached)
 */
function setHead(ref) {
  if (!files.inRepo()) {
    throw new Error("Not a repository (cannot set HEAD)");
  }

  const headFile = repoPath("HEAD");

  if (/^[0-9a-f]{40}$/i.test(ref)) {
    // Looks like a commit hash -> detached HEAD
    fs.writeFileSync(headFile, ref + "\n", "utf8");
    return;
  }

  if (ref.indexOf("refs/") === 0) {
    // Full ref provided
    fs.writeFileSync(headFile, "ref: " + ref + "\n", "utf8");
    return;
  }

  // Treat as branch name (e.g., "main")
  const fullRef = "refs/heads/" + ref;
  fs.writeFileSync(headFile, "ref: " + fullRef + "\n", "utf8");
}

/**
 * Update the current branch (or detached HEAD) to point at a specific commit hash.
 * If HEAD is symbolic (ref: ...), write the hash into that ref file.
 * Otherwise, write the hash directly into HEAD (detached state).
 */
function updateHeadTo(hash) {
  if (!/^[0-9a-f]{40}$/i.test(hash)) {
    throw new Error("Invalid commit hash supplied to updateHeadTo");
  }
  const headFile = repoPath("HEAD");
  if (!fs.existsSync(headFile)) {
    throw new Error("Not a repository (HEAD missing)");
  }
  const headRaw = fs.readFileSync(headFile, "utf8").trim();
  if (headRaw.indexOf("ref:") === 0) {
    const ref = headRaw.slice(4).trim();
    const refParts = ref.split("/");
    const refFile = repoPath.apply(null, refParts);
    const refDir = path.dirname(refFile);
    if (!fs.existsSync(refDir)) {
      fs.mkdirSync(refDir, { recursive: true });
    }
    fs.writeFileSync(refFile, hash + "\n", "utf8");
  } else {
    // detached
    fs.writeFileSync(headFile, hash + "\n", "utf8");
  }
}

/**
 * Read index file (.bit/index) as JSON, or return empty object if missing.
 */
function readIndex() {
  const indexFile = repoPath("index");
  if (!fs.existsSync(indexFile)) {
    return {};
  }

  try {
    const raw = fs.readFileSync(indexFile, "utf8");
    return JSON.parse(raw || "{}");
  } catch (e) {
    throw new Error("Failed to read index: " + e.message);
  }
}

/**
 * Write index file (.bit/index)
 */
function writeIndex(data) {
  const indexFile = repoPath("index");
  const gitletRoot = path.dirname(indexFile);
  if (!fs.existsSync(gitletRoot)) {
    fs.mkdirSync(gitletRoot, { recursive: true });
  }
  fs.writeFileSync(indexFile, JSON.stringify(data, null, 2) + "\n", "utf8");
}

/**
 * Read commit object by hash from .bit/objects/<hash>
 */
function readCommit(hash) {
  if (!hash) {
    throw new Error("hash required");
  }
  const objFile = repoPath("objects", hash);
  if (!fs.existsSync(objFile)) {
    throw new Error("commit not found: " + hash);
  }
  const raw = fs.readFileSync(objFile, "utf8");
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new Error("failed to parse commit " + hash + ": " + e.message);
  }
}

/**
 * Write commit object into .bit/objects/<sha1> and return the hash.
 */
function writeCommit(commit) {
  if (!commit || typeof commit !== "object") {
    throw new Error("commit must be an object");
  }

  const raw = JSON.stringify(commit);
  const hash = crypto.createHash("sha1").update(raw, "utf8").digest("hex");

  const objectsDir = repoPath("objects");
  if (!fs.existsSync(objectsDir)) {
    fs.mkdirSync(objectsDir, { recursive: true });
  }

  const objFile = path.join(objectsDir, hash);
  fs.writeFileSync(objFile, raw, "utf8");

  return hash;
}

module.exports = {
  initRepo,
  getHead,
  setHead,
  updateHeadTo,
  readIndex,
  writeIndex,
  readCommit,
  writeCommit,
};
