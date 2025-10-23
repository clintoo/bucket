const fs = require("fs");
const path = require("path");
const { getRepoRoot } = require("../lib/files");
const { getRemote, listRemoteRefs, getObject } = require("../lib/remote");
const {
  getHead,
  readCommit,
  writeObject,
  getObjectPath,
} = require("../lib/repo");

/**
 * Pull commits from a remote repository
 */
async function pullRemote(remoteName = "origin", branchName = null) {
  try {
    const repoRoot = getRepoRoot();
    const remote = getRemote(remoteName);
    if (!remote) {
      console.error(
        `Remote '${remoteName}' not found. Add it with 'bit remote add'.`
      );
      return;
    }

    // Determine branch to pull
    const headPath = path.join(repoRoot, ".bit", "HEAD");
    const headContent = fs.readFileSync(headPath, "utf8").trim();

    let localBranch;
    let localHash = null;

    if (headContent.startsWith("ref:")) {
      localBranch = headContent.slice(5).trim();
      if (branchName && localBranch !== branchName) {
        console.error(
          `HEAD is at ${localBranch}, but you specified ${branchName}`
        );
        return;
      }
      const refPath = path.join(repoRoot, ".bit", localBranch);
      if (fs.existsSync(refPath)) {
        localHash = fs.readFileSync(refPath, "utf8").trim();
      }
    } else {
      console.error("Detached HEAD. Cannot pull.");
      return;
    }

    console.log(`Pulling ${localBranch} from ${remoteName}...`);

    // Get remote refs
    const { refs: remoteRefs } = await listRemoteRefs(remote);
    const remoteRef = (remoteRefs || []).find((r) => r.name === localBranch);

    if (!remoteRef || !remoteRef.hash) {
      console.log("Remote branch does not exist yet.");
      return;
    }

    const remoteHash = remoteRef.hash;

    if (localHash === remoteHash) {
      console.log("Already up to date.");
      return;
    }

    // Collect all objects to fetch
    const objectsToFetch = [];
    const visited = new Set();

    async function collectObjects(hash) {
      if (!hash || visited.has(hash)) return;
      visited.add(hash);

      // Check if we already have this object
      const objPath = getObjectPath(hash);
      if (fs.existsSync(objPath)) return;

      objectsToFetch.push(hash);

      // Download and read commit to recurse
      let data;
      try {
        data = await getObject(remote, hash);
      } catch (e) {
        throw new Error(
          `Failed to get object ${hash}: ${
            e instanceof Error ? e.message : String(e)
          }`
        );
      }

      try {
        const commitObj = JSON.parse(data.toString("utf8"));
        if (commitObj.parent) {
          await collectObjects(commitObj.parent);
        }
        // Collect tree objects (blobs)
        for (const blobHash of Object.values(commitObj.tree)) {
          if (!visited.has(blobHash)) {
            visited.add(blobHash);
            const blobPath = getObjectPath(blobHash);
            if (!fs.existsSync(blobPath)) {
              objectsToFetch.push(blobHash);
            }
          }
        }
      } catch (error) {
        // Not a commit, probably a blob
      }
    }

    await collectObjects(remoteHash);

    if (objectsToFetch.length === 0) {
      console.log("No new objects to fetch");
    } else {
      console.log(`Downloading ${objectsToFetch.length} object(s)...`);

      // Download all objects
      for (const hash of objectsToFetch) {
        try {
          const data = await getObject(remote, hash);
          writeObject(hash, data);
        } catch (e) {
          throw new Error(
            `Failed to get object ${hash}: ${
              e instanceof Error ? e.message : String(e)
            }`
          );
        }
      }
    }

    // Update local ref
    console.log(`Updating ref ${localBranch}...`);
    const refPath = path.join(repoRoot, ".bit", localBranch);
    fs.mkdirSync(path.dirname(refPath), { recursive: true });
    fs.writeFileSync(refPath, remoteHash, "utf8");

    console.log("Pull complete!");

    // TODO: Optionally checkout the new tree
    console.log(
      "Note: Working directory not updated. Use 'bit restore' to update files."
    );
  } catch (error) {
    console.error("Pull failed:", error.message);
  }
}

module.exports = { pullRemote };
