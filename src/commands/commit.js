import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';

import { SlashCommandBuilder } from 'discord.js';

const execFileAsync = promisify(execFile);
const versionUrl = new URL('../version.json', import.meta.url);

async function git(args) {
  const { stdout } = await execFileAsync('git', args);
  return stdout.trim();
}

function shortCommit(commit) {
  return commit?.slice(0, 7) ?? 'unknown';
}

function sameCommit(left, right) {
  if (!left || !right) return false;
  return left === right || left.startsWith(right) || right.startsWith(left);
}

function repositoryFromRemote(remoteUrl) {
  const match = remoteUrl.match(/github\.com[:/]([^/]+\/[^/.]+)(?:\.git)?$/);
  return match?.[1] ?? null;
}

async function readVersionFile() {
  try {
    return JSON.parse(await readFile(versionUrl, 'utf8'));
  } catch {
    return null;
  }
}

async function currentVersion() {
  const version = await readVersionFile();
  if (version?.commit || version?.commitFull) return { ...version, source: 'version file' };

  const envCommit = process.env.GIT_COMMIT ?? process.env.GITHUB_SHA;
  if (envCommit) {
    return {
      commit: shortCommit(envCommit.trim()),
      commitFull: envCommit.trim(),
      branch: process.env.GITHUB_BRANCH ?? process.env.GITHUB_REF_NAME ?? 'main',
      repository: process.env.GITHUB_REPOSITORY,
      source: 'environment',
    };
  }

  const [commit, commitFull, branch, remoteUrl] = await Promise.all([
    git(['rev-parse', '--short', 'HEAD']),
    git(['rev-parse', 'HEAD']),
    git(['branch', '--show-current']),
    git(['remote', 'get-url', 'origin']),
  ]);

  return {
    commit,
    commitFull,
    branch,
    repository: repositoryFromRemote(remoteUrl),
    source: 'local git',
  };
}

async function latestGithubCommit(repository, branch) {
  if (!repository || !branch) return null;

  const response = await fetch(`https://api.github.com/repos/${repository}/commits/${branch}`, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'awesome-bot' },
  });

  if (!response.ok) {
    throw new Error(`GitHub returned ${response.status} for ${repository}@${branch}`);
  }

  const data = await response.json();
  return data.sha;
}

async function commitMessage() {
  try {
    const version = await currentVersion();
    let latestCommit = null;

    try {
      latestCommit = await latestGithubCommit(version.repository, version.branch);
    } catch (error) {
      console.error(error);
    }

    const runningCommit = version.commitFull ?? version.commit;
    const status = latestCommit && sameCommit(runningCommit, latestCommit) ? 'up to date' : 'behind';

    return [
      `Running commit: \`${shortCommit(runningCommit)}\``,
      latestCommit ? `GitHub ${version.branch}: \`${shortCommit(latestCommit)}\`` : 'GitHub latest: `unknown`',
      `Status: ${latestCommit ? status : 'unknown'}`,
    ].join('\n');
  } catch (error) {
    console.error(error);
    return 'Current commit: `unknown`';
  }
}

export const commitCommand = {
  slash: {
    data: new SlashCommandBuilder()
      .setName('commit')
      .setDescription('Show whether this bot is up to date with GitHub.'),

    async execute(interaction) {
      await interaction.reply(await commitMessage());
    },
  },

  text: {
    name: 'commit',
    aliases: ['version', 'sha'],

    async execute(message) {
      await message.reply(await commitMessage());
    },
  },
};
