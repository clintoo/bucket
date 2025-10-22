const fs = require("fs");
const path = require("path");
const { listRemoteRefs, getObject } = require("../lib/remote");
const { writeObject, getObjectPath } = require("../lib/repo");

/**
 * Clone a repository from a remote
 */
async function cloneRemote(url, repoId, targetDir = null) {
  try {
    const remote = { url, repoId };
    const dirName = targetDir || `repo-${repoId.slice(0, 8)}`;
    const repoRoot = path.resolve(process.cwd(), dirName);

    if (fs.existsSync(repoRoot)) {
      console.error(`Directory ${dirName} already exists`);
      return;
    }

    console.log(`Cloning into '${dirName}'...`);

    // Create .bit directory structure
    fs.mkdirSync(repoRoot, { recursive: true });
    fs.mkdirSync(path.join(repoRoot, ".bit", "objects"), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, ".bit", "refs", "heads"), {
      recursive: true,
    });

    // Get remote refs
    const remoteRefs = await listRemoteRefs(remote);
    const mainRef = remoteRefs.find((r) => r.name === "refs/heads/main");

    if (!mainRef || !mainRef.hash) {
      console.log("Remote repository is empty");
      // Still create empty repo
      fs.writeFileSync(
        path.join(repoRoot, ".bit", "HEAD"),
        "ref: refs/heads/main\n",
        "utf8"
      );
      fs.writeFileSync(path.join(repoRoot, ".bit", "index"), "{}", "utf8");
      return;
    }

    const remoteHash = mainRef.hash;

    // Collect all objects to fetch
    const objectsToFetch = [];
    const visited = new Set();

    async function collectObjects(hash) {
      if (!hash || visited.has(hash)) return;
      visited.add(hash);

      objectsToFetch.push(hash);

      // Download and read commit to recurse
      const data = await getObject(remote, hash);

      try {
        const commitObj = JSON.parse(data.toString("utf8"));
        if (commitObj.parent) {
          await collectObjects(commitObj.parent);
        }
        // Collect tree objects (blobs)
        for (const blobHash of Object.values(commitObj.tree)) {
          if (!visited.has(blobHash)) {
            visited.add(blobHash);
            objectsToFetch.push(blobHash);
          }
        }
      } catch (error) {
        // Not a commit, probably a blob
      }
    }

    await collectObjects(remoteHash);

    console.log(`Downloading ${objectsToFetch.length} object(s)...`);

    // Download all objects to the new repo
    for (const hash of objectsToFetch) {
      const data = await getObject(remote, hash);
      const objPath = path.join(
        repoRoot,
        ".bit",
        "objects",
        hash.slice(0, 2),
        hash.slice(2)
      );
      fs.mkdirSync(path.dirname(objPath), { recursive: true });
      fs.writeFileSync(objPath, data);
    }

    // Set up HEAD and main branch
    fs.writeFileSync(
      path.join(repoRoot, ".bit", "HEAD"),
      "ref: refs/heads/main\n",
      "utf8"
    );
    fs.writeFileSync(
      path.join(repoRoot, ".bit", "refs", "heads", "main"),
      remoteHash,
      "utf8"
    );

    // Save remote config
    const config = {
      remotes: {
        origin: { url, repoId },
      },
    };
    fs.writeFileSync(
      path.join(repoRoot, ".bit", "config"),
      JSON.stringify(config, null, 2),
      "utf8"
    );

    // Checkout the tree (restore all files)
    const commitData = fs.readFileSync(
      path.join(
        repoRoot,
        ".bit",
        "objects",
        remoteHash.slice(0, 2),
        remoteHash.slice(2)
      ),
      "utf8"
    );
    const commit = JSON.parse(commitData);

    for (const [filePath, blobHash] of Object.entries(commit.tree)) {
      const blobPath = path.join(
        repoRoot,
        ".bit",
        "objects",
        blobHash.slice(0, 2),
        blobHash.slice(2)
      );
      const content = fs.readFileSync(blobPath);
      const targetPath = path.join(repoRoot, filePath);
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.writeFileSync(targetPath, content);
    }

    // Create index from tree
    fs.writeFileSync(
      path.join(repoRoot, ".bit", "index"),
      JSON.stringify(commit.tree, null, 2),
      "utf8"
    );

    console.log("Clone complete!");
  } catch (error) {
    console.error("Clone failed:", error.message);
  }
}

module.exports = { cloneRemote };
