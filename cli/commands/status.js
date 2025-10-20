//logic for "bit status" command"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// Load repo helpers from cli/lib/repo (commands directory -> ../lib/repo)
function loadRepo() {
  const p = path.join(__dirname, "..", "lib", "repo");
  try {
    return require(p);
  } catch (err) {
    console.error(`Failed to load repo helpers from ${p}.`);
    throw err;
  }
}
const { readIndex, getHead, readCommit } = loadRepo();

/**
 * Compute sha1 hex for given Buffer/string (no git header) — no object write side-effects.
 */
function sha1Hex(data) {
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(String(data), "utf8");
  return crypto.createHash("sha1").update(buf).digest("hex");
}

/**
 * Recursively walk working tree starting at cwd and collect regular files.
 * Skips common repo metadata directories (e.g. .bit, .mygit, .git) and node_modules.
 * Returns absolute file paths.
 */
function collectWorkFiles(base = process.cwd()) {
  const skipDirs = new Set([".bit", ".mygit", ".git", "node_modules"]);
  const files = [];

  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (err) {
      return;
    }
    for (const e of entries) {
      // Skip metadata dirs
      if (e.isDirectory() && skipDirs.has(e.name)) continue;

      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        walk(full);
      } else if (e.isFile()) {
        files.push(full);
      }
      // ignore symlinks, sockets, etc.
    }
  }

  walk(base);
  return files;
}

/**
 * Pretty-print a change entry
 */
function printEntry(pathStr, note) {
  if (note) {
    console.log(`\t${pathStr}\t${note}`);
  } else {
    console.log(`\t${pathStr}`);
  }
}

/**
 * Main status implementation (similar-ish to `git status`).
 * - Shows staged changes (index vs HEAD)
 * - Shows changes not staged (working tree vs index)
 * - Shows untracked files (working tree not in index)
 */
module.exports = function status() {
  try {
    const index = readIndex() || {};
    const headRef = getHead(); // may be commit hash or null

    // Read HEAD commit tree if available (commit.tree is an index snapshot)
    let headTree = null;
    if (headRef) {
      try {
        const headCommit = readCommit(headRef);
        headTree = (headCommit && headCommit.tree) || {};
      } catch (err) {
        // if HEAD exists but commit can't be read, treat as no HEAD tree
        headTree = {};
        console.error(
          `warning: failed to read HEAD commit ${headRef}: ${err.message}`
        );
      }
    } else {
      headTree = {};
    }

    // Determine staged changes (index vs headTree)
    const stagedAdded = [];
    const stagedModified = [];
    const stagedDeleted = [];

    // Files present in index
    for (const p of Object.keys(index)) {
      if (!(p in headTree)) {
        stagedAdded.push(p);
      } else if (index[p] !== headTree[p]) {
        stagedModified.push(p);
      }
    }
    // Files present in head but removed from index => staged deletions
    for (const p of Object.keys(headTree)) {
      if (!(p in index)) stagedDeleted.push(p);
    }

    // Working directory files
    const workFilesAbs = collectWorkFiles();
    const workFilesRel = workFilesAbs.map((fp) =>
      path.relative(process.cwd(), fp).split(path.sep).join("/")
    );

    // Map working file path -> sha
    const workHashes = {};
    for (let i = 0; i < workFilesAbs.length; i++) {
      const abs = workFilesAbs[i];
      const rel = workFilesRel[i];
      try {
        const data = fs.readFileSync(abs);
        workHashes[rel] = sha1Hex(data);
      } catch (err) {
        // skip unreadable files
      }
    }

    // Changes not staged for commit: files tracked in index but working copy differs
    const modifiedNotStaged = [];
    for (const p of Object.keys(index)) {
      // If file missing in working tree -> treat as deleted in working dir (not staged)
      if (!(p in workHashes)) {
        modifiedNotStaged.push({ path: p, type: "deleted" });
        continue;
      }
      const workHash = workHashes[p];
      if (!workHash) continue;
      if (workHash !== index[p]) {
        // If index equals HEAD and working differs, it's modified but not staged
        modifiedNotStaged.push({ path: p, type: "modified" });
      }
    }

    // Untracked: files present in working tree but not in index and not under repo metadata
    const untracked = [];
    for (const rel of workFilesRel) {
      if (!(rel in index)) {
        // ignore files that look like internal repo files (safety)
        if (
          rel.startsWith(".bit/") ||
          rel === ".bit" ||
          rel.startsWith(".mygit/") ||
          rel === ".mygit" ||
          rel.startsWith(".git/") ||
          rel === ".git"
        ) {
          continue;
        }
        untracked.push(rel);
      }
    }

    // Print status report
    // Header: show HEAD info if available
    if (headRef) {
      console.log(`On HEAD: ${headRef}`);
    } else {
      console.log("Not currently on any HEAD (no commits)");
    }
    console.log("");

    // If there is no HEAD (no commits), do not show 'Changes to be committed' from index vs empty head in a confusing way.
    // Instead, mimic Git: with no commits, staged area is effectively everything in index vs nothing, but we still display it as staged.
    if (stagedAdded.length || stagedModified.length || stagedDeleted.length) {
      console.log("Changes to be committed:");
      for (const p of stagedAdded) printEntry(p, "(new file)");
      for (const p of stagedModified) printEntry(p, "(modified)");
      for (const p of stagedDeleted) printEntry(p, "(deleted)");
      console.log("");
    } else {
      console.log("No changes staged for commit.");
      console.log("");
    }

    if (modifiedNotStaged.length) {
      console.log("Changes not staged for commit:");
      for (const e of modifiedNotStaged) {
        printEntry(e.path, e.type === "deleted" ? "(deleted)" : "(modified)");
      }
      console.log("");
    } else {
      console.log("No changes not staged for commit.");
      console.log("");
    }

    if (untracked.length) {
      console.log("Untracked files:");
      for (const u of untracked) printEntry(u);
      console.log("");
    } else {
      console.log("No untracked files.");
      console.log("");
    }

    // Summary line
    const totalChanges =
      stagedAdded.length +
      stagedModified.length +
      stagedDeleted.length +
      modifiedNotStaged.length +
      untracked.length;
    if (totalChanges === 0) {
      console.log("nothing to commit, working tree clean");
    } else {
      console.log("use 'bit add <file>' to update what will be committed");
    }
  } catch (err) {
    console.error("Failed to compute status:", err.message);
    throw err;
  }
};
