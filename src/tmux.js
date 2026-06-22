import { execFileSync, execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFileCb);

export function buildCaptureArgs(pane, lines = 200) {
  return ['capture-pane', '-t', pane, '-p', '-S', `-${lines}`];
}

export function buildSendKeysArgs(pane, text) {
  return ['send-keys', '-t', pane, text, 'Enter'];
}

export function buildDisplayArgs(pane, format) {
  return ['display-message', '-t', pane, '-p', format];
}

export function parseTmuxVersion(versionString) {
  const match = versionString.match(/tmux\s+(\d+\.\d+)/);
  return match ? parseFloat(match[1]) : 0;
}

export function getTmuxVersion() {
  try {
    return parseTmuxVersion(execFileSync('tmux', ['-V'], { encoding: 'utf-8' }).trim());
  } catch { return 0; }
}

export async function capturePane(pane, lines = 200) {
  const { stdout } = await execFileAsync('tmux', buildCaptureArgs(pane, lines));
  return stdout;
}

export async function sendKeys(pane, text) {
  await execFileAsync('tmux', buildSendKeysArgs(pane, text));
}

export async function getPaneCommand(pane) {
  const { stdout } = await execFileAsync('tmux', buildDisplayArgs(pane, '#{pane_current_command}'));
  return stdout.trim();
}

async function getChildPidsMap() {
  const { stdout } = await execFileAsync('ps', ['-A', '-o', 'pid=,ppid=']);
  const map = new Map();
  for (const line of stdout.split('\n')) {
    const m = line.trim().match(/^(\d+)\s+(\d+)$/);
    if (!m) continue;
    const pid = Number(m[1]);
    const ppid = Number(m[2]);
    if (!map.has(ppid)) map.set(ppid, []);
    map.get(ppid).push(pid);
  }
  return map;
}

export async function getDescendantPids(pid) {
  const map = await getChildPidsMap();
  const out = [];
  const stack = [...(map.get(pid) || [])];
  while (stack.length) {
    const p = stack.pop();
    out.push(p);
    for (const c of (map.get(p) || [])) stack.push(c);
  }
  return out;
}

export async function isProcessForeground(pid) {
  let directStat;
  try {
    const { stdout } = await execFileAsync('ps', ['-o', 'stat=', '-p', String(pid)]);
    directStat = stdout.trim();
  } catch {
    return null;
  }
  if (directStat.includes('+')) return true;
  // The process may have re-exec'd or spawned a child (launcher shims) that
  // actually holds the terminal foreground. Walk the descendant tree for '+'.
  try {
    for (const child of await getDescendantPids(pid)) {
      const { stdout } = await execFileAsync('ps', ['-o', 'stat=', '-p', String(child)]);
      if (stdout.includes('+')) return true;
    }
  } catch { /* best effort — fall through */ }
  return false;
}

// Normalize tty identifiers to a comparable form across `ps` and tmux:
//   "/dev/ttys003" -> "s003"  (macOS),  "/dev/pts/3" -> "pts/3"  (Linux)
export function normalizeTty(t) {
  return String(t).trim().replace(/^\/dev\//, '').replace(/^tty/, '');
}

export async function getProcessTty(pid) {
  try {
    const { stdout } = await execFileAsync('ps', ['-o', 'tty=', '-p', String(pid)]);
    const t = stdout.trim();
    return (t && t !== '?' && t !== '??' && t !== '-') ? t : null;
  } catch {
    return null;
  }
}

export async function getPaneTty(pane) {
  try {
    const { stdout } = await execFileAsync('tmux', buildDisplayArgs(pane, '#{pane_tty}'));
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

// Robust last-resort check: is the live Claude process (or a descendant)
// actually attached to THIS pane's tty? On macOS + tmux (esp. `-CC`), both
// pane_current_command and the ps '+' foreground flag can misreport "zsh",
// so confirming the controlling tty avoids skipping send-keys forever.
export async function isProcessInPane(pid, pane) {
  const paneTty = await getPaneTty(pane);
  if (!paneTty) return false;
  const target = normalizeTty(paneTty);
  const procTty = await getProcessTty(pid);
  if (procTty && normalizeTty(procTty) === target) return true;
  try {
    for (const child of await getDescendantPids(pid)) {
      const childTty = await getProcessTty(child);
      if (childTty && normalizeTty(childTty) === target) return true;
    }
  } catch { /* best effort */ }
  return false;
}

export function isInsideTmux() { return !!process.env.TMUX; }
export function getCurrentPane() { return process.env.TMUX_PANE || null; }
