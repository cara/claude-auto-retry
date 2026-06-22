import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildCaptureArgs, buildSendKeysArgs, buildDisplayArgs, parseTmuxVersion, normalizeTty } from '../src/tmux.js';

describe('buildCaptureArgs', () => {
  it('builds correct args', () => {
    assert.deepEqual(buildCaptureArgs('%3', 200),
      ['capture-pane', '-t', '%3', '-p', '-S', '-200']);
  });
});
describe('buildSendKeysArgs', () => {
  it('builds correct args with Enter', () => {
    assert.deepEqual(buildSendKeysArgs('%3', 'hello world'),
      ['send-keys', '-t', '%3', 'hello world', 'Enter']);
  });
});
describe('buildDisplayArgs', () => {
  it('builds correct args', () => {
    assert.deepEqual(buildDisplayArgs('%3', '#{pane_current_command}'),
      ['display-message', '-t', '%3', '-p', '#{pane_current_command}']);
  });
});
describe('parseTmuxVersion', () => {
  it('parses "tmux 3.4"', () => { assert.equal(parseTmuxVersion('tmux 3.4'), 3.4); });
  it('parses "tmux 2.1"', () => { assert.equal(parseTmuxVersion('tmux 2.1'), 2.1); });
  it('returns 0 for unparseable', () => { assert.equal(parseTmuxVersion('not tmux'), 0); });
});
describe('normalizeTty', () => {
  it('normalizes macOS /dev/ttys003 and ps "s003" to the same value', () => {
    assert.equal(normalizeTty('/dev/ttys003'), 's003');
    assert.equal(normalizeTty('s003'), 's003');
    assert.equal(normalizeTty('/dev/ttys003'), normalizeTty('s003'));
  });
  it('normalizes Linux /dev/pts/3', () => {
    assert.equal(normalizeTty('/dev/pts/3'), 'pts/3');
    assert.equal(normalizeTty('pts/3'), 'pts/3');
  });
  it('trims whitespace', () => {
    assert.equal(normalizeTty('  /dev/ttys003 \n'), 's003');
  });
});
