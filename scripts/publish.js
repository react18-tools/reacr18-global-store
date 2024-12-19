/** It is assumed that this is called only from the default branch. */
const { execSync } = require("child_process");

// Apply changesets if any -- e.g., coming from pre-release branches
try {
  execSync("pnpm changeset pre exit");
} catch {
  // empty
}
try {
  execSync("pnpm changeset version");
  execSync(
    `git add . && git commit -m "Apply changesets and update CHANGELOG" && git push origin ${process.env.BRANCH}`,
  );
} catch {
  // no changesets to be applied
}

const { version: VERSION, name } = require("../lib/package.json");
let LATEST_VERSION = "0.0.-1";

try {
  LATEST_VERSION = execSync(`npm view ${name} version`).toString() ?? "0.0.-1";
} catch {
  // empty
}

console.log({ VERSION, LATEST_VERSION });

const [newMajor, newMinor] = VERSION.split(".");
const [oldMajor, oldMinor] = LATEST_VERSION.split(".");

const isPatch = newMajor === oldMajor && newMinor === oldMinor;

const releaseBranch = `release-${newMajor}.${newMinor}`;
const DEFAULT_BRANCH = process.env.DEFAULT_BRANCH;

if (!isPatch) {
  require("./update-security-md")(`${newMajor}.${newMinor}`, `${oldMajor}.${oldMinor}`);
  /** Create new release branch for every Major or Minor release */
  execSync(`git checkout -b ${releaseBranch} && git push origin ${releaseBranch}`);
} else {
  // update release branch
  execSync(
    `git checkout ${releaseBranch} && git merge ${DEFAULT_BRANCH} && git push origin ${releaseBranch}`,
  );
}

/** Create release */
execSync("cd lib && pnpm build && npm publish --provenance --access public");

/** Create GitHub release */
execSync(
  `gh release create ${VERSION} --generate-notes --latest -n "$(sed '1,/^## /d;/^## /,$d' CHANGELOG.md)" --title "Release v${VERSION}"`,
);

// Publish canonical packages
execSync("node scripts/publish-canonical.js");
