import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const versionPath = new URL('../src/version.json', import.meta.url);
const versionFilePath = fileURLToPath(versionPath);

async function git(args) {
  const { stdout } = await execFileAsync('git', args);
  return stdout.trim();
}

function repositoryFromRemote(remoteUrl) {
  const match = remoteUrl.match(/github\.com[:/]([^/]+\/[^/.]+)(?:\.git)?$/);
  return match?.[1] ?? null;
}

const [commit, commitFull, branch, remoteUrl] = await Promise.all([
  git(['rev-parse', '--short', 'HEAD']),
  git(['rev-parse', 'HEAD']),
  git(['branch', '--show-current']),
  git(['remote', 'get-url', 'origin']),
]);

const version = {
  commit,
  commitFull,
  branch,
  repository: repositoryFromRemote(remoteUrl),
  builtAt: new Date().toISOString(),
};

await mkdir(dirname(versionFilePath), { recursive: true });
await writeFile(versionPath, `${JSON.stringify(version, null, 2)}\n`);

console.log(`Wrote ${versionFilePath} for ${version.repository ?? 'unknown repository'}@${commit}`);
