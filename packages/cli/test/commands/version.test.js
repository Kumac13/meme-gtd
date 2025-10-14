import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';

const CLI_PATH = './packages/cli/dist/index.js';

describe('version command', () => {
  before(() => {
    // Ensure CLI is built
    try {
      execSync('pnpm --filter meme-gtd-cli build', { stdio: 'ignore' });
    } catch (error) {
      console.error('Failed to build CLI:', error);
      throw error;
    }
  });

  it('displays version with --version flag', () => {
    const output = execSync(`node ${CLI_PATH} --version`, { encoding: 'utf-8' });
    assert.match(output, /^\d+\.\d+\.\d+/);
  });

  it('displays version with -v flag', () => {
    const output = execSync(`node ${CLI_PATH} -v`, { encoding: 'utf-8' });
    assert.match(output, /^\d+\.\d+\.\d+/);
  });

  it('displays detailed info with version subcommand', () => {
    const output = execSync(`node ${CLI_PATH} version`, { encoding: 'utf-8' });
    assert.match(output, /mgtd version \d+\.\d+\.\d+/);
    assert.match(output, /Node\.js v\d+/);
    assert.match(output, /Platform:/);
  });

  it('outputs valid JSON with --json flag', () => {
    const output = execSync(`node ${CLI_PATH} version --json`, { encoding: 'utf-8' });
    const json = JSON.parse(output);
    assert.ok(json.version);
    assert.ok(json.name);
    assert.ok(json.node.version);
    assert.ok(json.node.required);
    assert.ok(json.platform);
    assert.ok(json.arch);
  });

  it('prioritizes version flag over other commands', () => {
    const output = execSync(`node ${CLI_PATH} memo list --version`, { encoding: 'utf-8' });
    assert.match(output, /^\d+\.\d+\.\d+/);
  });
});
