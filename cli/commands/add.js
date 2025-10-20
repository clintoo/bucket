const fs = require("fs");
const path = require("path");
// changed: correct relative path from cli/commands -> cli/../.. -> /workspaces/bit/lib
const { hashObject } = require("../lib/objects");
const { readIndex, writeIndex } = require("../lib/repo");

/**
 * Add files to the index (like `git add`).
 * - Accepts a single path or an array of paths.
 * - Recurses into directories.
 * - Uses Buffer to support binary files.
 *
 * @param {string|string[]} inputPath - file or directory path (or array of them)
 */
module.exports = function add(inputPath) {
  // Normalize input to an array
  const paths = Array.isArray(inputPath) ? inputPath.slice() : [inputPath];

  // Collect files to add (absolute paths)
  const filesToAdd = [];
  // Collect tracked paths to remove from index (staged deletions)
  const removals = new Set();

  // Helper: recursively collect regular files from a path
  function collect(p) {
    try {
      const stat = fs.statSync(p);
      if (stat.isDirectory()) {
        // read directory entries and recurse
        const entries = fs.readdirSync(p);
        for (const e of entries) {
          collect(path.join(p, e));
        }
      } else if (stat.isFile()) {
        filesToAdd.push(p);
      } // ignore other types (symlinks, sockets, etc.)
    } catch (err) {
      // If missing, mark for potential staged deletion; else warn
      if (err && (err.code === "ENOENT" || err.code === "ENOTDIR")) {
        removals.add(p);
      } else {
        console.error(`warning: cannot access ${p}: ${err.message}`);
      }
    }
  }

  for (const p of paths) {
    collect(p);
  }

  // Don't early return; we may still stage deletions even if no files were found

  // Read index once, update in-memory, write once for efficiency.
  const index = readIndex();

  // Repo dir guard: don't allow adding files inside the repository metadata dir.
  // Default name commonly used is '.bit' — skip any paths under that directory.
  const repoMetaDir = ".bit";

  let addedCount = 0;
  let removedCount = 0;
  for (const absPath of filesToAdd) {
    // Compute a path relative to cwd and normalize to POSIX style for the index.
    const rel = path.relative(process.cwd(), absPath) || path.basename(absPath);
    const relPosix = rel.split(path.sep).join("/");

    if (relPosix === repoMetaDir || relPosix.startsWith(repoMetaDir + "/")) {
      // Skip internal repository metadata
      continue;
    }

    try {
      // Read file as Buffer to support binary files
      const data = fs.readFileSync(absPath);
      const hash = hashObject(data);

      // Avoid unnecessary writes if hash is identical
      if (index[relPosix] === hash) {
        // already up-to-date
        continue;
      }

      index[relPosix] = hash;
      addedCount++;
      console.log(`Added ${relPosix}`);
    } catch (err) {
      console.error(`Failed to add ${relPosix}: ${err.message}`);
    }
  }

  // Handle removals: remove tracked entries that no longer exist on disk.
  // For each provided input path, if it was missing (ENOENT) or is a directory,
  // scan index entries under that path and remove ones that don't exist.
  // Handle removals: remove tracked entries that no longer exist on disk.
  // For each provided input path, if it was missing (ENOENT) or is a directory,
  // scan index entries under that path and remove ones that don't exist.
  function stageDeletionForPath(input) {
    const abs = path.resolve(input);
    const relRaw = path.relative(process.cwd(), abs);
    const isExistingDir = fs.existsSync(abs) && fs.statSync(abs).isDirectory();
    const isRootDir = relRaw === "" && isExistingDir;
    const relPosix = relRaw
      ? relRaw.split(path.sep).join("/")
      : isRootDir
      ? ""
      : path.basename(abs);

    // Build a predicate: entries exactly equal to file, or under directory prefix
    const isDir = isExistingDir;
    const prefix = isDir ? (isRootDir ? "" : relPosix + "/") : null;

    for (const tracked of Object.keys(index)) {
      const candidate = tracked;

      let matches = false;
      if (isDir) {
        matches = prefix === "" ? true : candidate.startsWith(prefix);
      } else {
        // Exact path match
        matches = candidate === relPosix;
      }

      if (!matches) continue;

      // If the corresponding working file doesn't exist, remove from index
      const candidateAbs = path.join(
        process.cwd(),
        candidate.split("/").join(path.sep)
      );
      if (!fs.existsSync(candidateAbs)) {
        delete index[candidate];
        removedCount++;
        console.log(`Removed ${candidate}`);
      }
    }
  }

  // Stage deletions for any missing inputs we collected
  for (const r of removals) {
    stageDeletionForPath(r);
  }
  // Also stage deletions under directories explicitly provided
  for (const p of paths) {
    try {
      const st = fs.statSync(p);
      if (st.isDirectory()) stageDeletionForPath(p);
    } catch (_) {
      // already handled via removals
    }
  }

  if (addedCount > 0 || removedCount > 0) {
    try {
      writeIndex(index);
    } catch (err) {
      console.error(`Failed to update index: ${err.message}`);
      throw err;
    }
  } else {
    console.log("No changes to index.");
  }
};
