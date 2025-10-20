// changed: correct relative path to shared repo helpers
const {
  readIndex,
  writeCommit,
  getHead,
  setHead,
  updateHeadTo,
  readCommit,
} = require("../lib/repo");
const { randomUUID } = require("crypto"); // use built-in UUID generator
const os = require("os");
const { isDeepStrictEqual } = require("util");

/**
 * Create a new commit from the current index.
 * @param {Object} opts
 * @param {string} opts.message - commit message (required)
 * @param {boolean} [opts.allowEmpty=false] - allow creating commits without changes
 */
module.exports = function commit(opts = {}) {
  const { message, allowEmpty = false } = opts;

  // Validate message
  if (!message || typeof message !== "string" || message.trim() === "") {
    throw new Error("Commit message is required.");
  }

  // Read the index (in-memory representation of the tree)
  const index = readIndex() || {};

  // Determine parent commit (if any)
  const parent = getHead();

  // Try to read the parent commit's tree to detect no-op commits
  let parentTree;
  if (typeof readCommit === "function" && parent) {
    try {
      const parentCommit = readCommit(parent);
      parentTree = parentCommit && parentCommit.tree;
    } catch (err) {
      // If reading parent fails, don't block committing; just proceed.
      console.error(
        `warning: could not read parent commit ${parent}: ${err.message}`
      );
    }
  }

  // If index equals parent's tree and empty commits are not allowed, skip
  if (
    !allowEmpty &&
    parent &&
    parentTree &&
    isDeepStrictEqual(index, parentTree)
  ) {
    console.log("No changes to commit.");
    return;
  }

  // Determine author/committer info from env or OS
  const authorName =
    process.env.BIT_AUTHOR_NAME ||
    process.env.GIT_AUTHOR_NAME ||
    (os.userInfo && os.userInfo().username) ||
    "unknown";
  const authorEmail =
    process.env.BIT_AUTHOR_EMAIL ||
    process.env.GIT_AUTHOR_EMAIL ||
    `${authorName}@localhost`;

  const commitObj = {
    message: message.trim(),
    timestamp: new Date().toISOString(),
    parent: parent || null,
    tree: index,
    author: { name: authorName, email: authorEmail },
    committer: { name: authorName, email: authorEmail },
  };

  try {
    // Persist the commit (returns the content-addressed hash like Git)
    const hash = writeCommit(commitObj);

    // Update the current branch (or detached HEAD) to point at this commit
    updateHeadTo(hash);

    console.log(`Committed: ${hash} - ${commitObj.message}`);
  } catch (err) {
    console.error(`Failed to write commit: ${err.message}`);
    throw err;
  }
};
