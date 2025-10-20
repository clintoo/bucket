"use strict";

/**
 * Minimal serializer for a small git-like config structure.
 * Input example:
 *  { core: { "": { bare: true }, packed: { threads: 1 } } }
 *
 * Produces an INI-like string:
 *  [core]
 *      bare = true
 *  [core "packed"]
 *      threads = 1
 */
function objToStr(obj) {
  if (!obj || typeof obj !== "object") return "";

  const lines = [];

  for (const section of Object.keys(obj)) {
    const sectionBody = obj[section];
    if (typeof sectionBody !== "object") continue;

    for (const subsectionKey of Object.keys(sectionBody)) {
      const subsection = sectionBody[subsectionKey];

      let header = `[${section}]`;
      if (subsectionKey && subsectionKey !== "") {
        header = `[${section} "${subsectionKey}"]`;
      }
      lines.push(header);

      if (typeof subsection === "object" && subsection !== null) {
        for (const k of Object.keys(subsection)) {
          const v = subsection[k];
          lines.push(`\t${k} = ${String(v)}`);
        }
      }
      lines.push(""); // blank line between sections
    }
  }

  return lines.join("\n");
}

module.exports = {
  objToStr,
};
