const fs = require("fs");
const path = require("path");
const os = require("os");
const { getRepoRoot } = require("./files");
const { objToStr } = require("./config");

function getAuthToken() {
  if (process.env.BIT_TOKEN) {
    return process.env.BIT_TOKEN;
  }
  const tokenPath = path.join(os.homedir(), ".bit", "token");
  if (fs.existsSync(tokenPath)) {
    return fs.readFileSync(tokenPath, "utf8").trim();
  }
  return null;
}

function setAuthToken(token) {
  const bitDir = path.join(os.homedir(), ".bit");
  if (!fs.existsSync(bitDir)) {
    fs.mkdirSync(bitDir, { recursive: true });
  }
  fs.writeFileSync(path.join(bitDir, "token"), token, "utf8");
}

function getConfigPath() {
  const repoRoot = getRepoRoot();
  return path.join(repoRoot, ".bit", "config");
}

function readConfig() {
  try {
    const configPath = getConfigPath();
    if (!fs.existsSync(configPath)) {
      return {};
    }
    const content = fs.readFileSync(configPath, "utf8");
    return JSON.parse(content);
  } catch (error) {
    return {};
  }
}

function writeConfig(config) {
  const configPath = getConfigPath();
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");
}

function setRemote(name, url, repoId) {
  const config = readConfig();
  if (!config.remotes) {
    config.remotes = {};
  }
  config.remotes[name] = { url, repoId };
  writeConfig(config);
}

function getRemote(name) {
  const config = readConfig();
  return config.remotes?.[name] || null;
}

async function listRemoteRefs(remote) {
  const token = getAuthToken();
  if (!token) {
    throw new Error("Not authenticated. Run 'bit login' first.");
  }

  // Extract base URL (remove /bit-objects if present)
  let baseUrl = remote.url.replace(/\/bit-objects$/, "");

  const response = await fetch(
    `${baseUrl}/bit-refs/repos/${remote.repoId}/refs`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );
  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: "Request failed" }));
    throw new Error(
      `Failed to list refs: ${error.error || response.statusText}`
    );
  }
  return await response.json();
}

async function headObject(remote, hash) {
  const token = getAuthToken();
  if (!token) {
    throw new Error("Not authenticated. Run 'bit login' first.");
  }

  // Extract base URL (remove /bit-objects if present)
  let baseUrl = remote.url.replace(/\/bit-objects$/, "");

  const response = await fetch(
    `${baseUrl}/bit-objects/repos/${remote.repoId}/objects/${hash}`,
    {
      method: "HEAD",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return response.ok;
}

async function getObject(remote, hash) {
  const token = getAuthToken();
  if (!token) {
    throw new Error("Not authenticated. Run 'bit login' first.");
  }

  // Extract base URL (remove /bit-objects if present)
  let baseUrl = remote.url.replace(/\/bit-objects$/, "");

  const response = await fetch(
    `${baseUrl}/bit-objects/repos/${remote.repoId}/objects/${hash}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: "Request failed" }));
    throw new Error(
      `Failed to get object: ${error.error || response.statusText}`
    );
  }
  return Buffer.from(await response.arrayBuffer());
}

async function putObject(remote, hash, data) {
  const token = getAuthToken();
  if (!token) {
    throw new Error("Not authenticated. Run 'bit login' first.");
  }

  // Extract base URL (remove /bit-objects if present)
  let baseUrl = remote.url.replace(/\/bit-objects$/, "");

  const response = await fetch(
    `${baseUrl}/bit-objects/repos/${remote.repoId}/objects/${hash}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/octet-stream",
      },
      body: data,
    }
  );
  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: "Request failed" }));
    throw new Error(
      `Failed to put object: ${error.error || response.statusText}`
    );
  }
}

async function updateRemoteRef(remote, refName, oldHash, newHash) {
  const token = getAuthToken();
  if (!token) {
    throw new Error("Not authenticated. Run 'bit login' first.");
  }

  // Extract base URL (remove /bit-objects if present)
  let baseUrl = remote.url.replace(/\/bit-objects$/, "");

  const response = await fetch(
    `${baseUrl}/bit-refs/repos/${remote.repoId}/refs/${encodeURIComponent(
      refName
    )}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ oldHash, newHash }),
    }
  );
  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: "Request failed" }));
    if (response.status === 409) {
      throw new Error(
        "CAS_FAILED: Remote ref was updated by another push. Pull and try again."
      );
    }
    throw new Error(
      `Failed to update ref: ${error.error || response.statusText}`
    );
  }
}

module.exports = {
  getAuthToken,
  setAuthToken,
  readConfig,
  writeConfig,
  setRemote,
  getRemote,
  listRemoteRefs,
  headObject,
  getObject,
  putObject,
  updateRemoteRef,
};
