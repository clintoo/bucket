// Minimal fast-forward merge: if other is descendant, move HEAD ref
const path = require("path");
const { getHead, readCommit, updateHeadTo } = require("../lib/repo");

module.exports = function merge(otherHash) {
  if (!otherHash) throw new Error("merge: other commit hash required");
  const current = getHead();
  if (!current) {
    updateHeadTo(otherHash);
    console.log(`Fast-forward to ${otherHash}`);
    return;
  }

  // Walk ancestry of other to see if it includes current
  let h = otherHash;
  const seen = new Set();
  while (h && !seen.has(h)) {
    if (h === current) {
      updateHeadTo(otherHash);
      console.log(`Fast-forward to ${otherHash}`);
      return;
    }
    seen.add(h);
    try {
      const c = readCommit(h);
      h = c && c.parent;
    } catch (_) {
      break;
    }
  }

  throw new Error(
    "merge: non-fast-forward merge not supported in this minimal implementation"
  );
};
