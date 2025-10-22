const { setAuthToken, getAuthToken } = require("../lib/remote");

/**
 * Authenticate with remote repository
 */
function login(token) {
  if (!token) {
    console.error("Usage: bit login <token>");
    console.error("");
    console.error("Get your token from the web UI at:");
    console.error("  https://your-hub.com/profile");
    console.error("");
    console.error("Or set the BIT_TOKEN environment variable");
    return;
  }

  setAuthToken(token);
  console.log("Authentication token saved to ~/.bit/token");
  console.log("You can now push and pull to remote repositories");
}

/**
 * Show current authentication status
 */
function whoami() {
  const token = getAuthToken();
  if (!token) {
    console.log("Not logged in. Run 'bit login <token>' to authenticate.");
    return;
  }

  // Decode JWT to show user info (basic decoding, no verification)
  try {
    const payload = token.split(".")[1];
    const decoded = JSON.parse(Buffer.from(payload, "base64").toString("utf8"));
    console.log("Logged in as:", decoded.email || decoded.sub);
    console.log(
      "Token expires:",
      new Date(decoded.exp * 1000).toLocaleString()
    );
  } catch (error) {
    console.log("Logged in (token format not recognized)");
  }
}

module.exports = { login, whoami };
