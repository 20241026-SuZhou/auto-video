import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const args = process.argv.slice(2);
const options = {install: false, toolchain: path.resolve('.video-toolchain'), report: null};
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--install') options.install = true;
  else if (['--toolchain', '--report', '--browser'].includes(args[i]) && args[i + 1]) options[args[i].slice(2)] = path.resolve(args[++i]);
  else if (args[i] === '--help') {
    console.log('node preflight.mjs --toolchain <directory> [--install] [--report <json>] [--browser <executable>]');
    process.exit(0);
  } else throw new Error(`Unknown or incomplete argument: ${args[i]}`);
}
const report = {checked_at: new Date().toISOString(), platform: process.platform, toolchain: options.toolchain, install_requested: options.install, checks: {}, ok: false};
const windows = process.platform === 'win32';
if (options.browser) {
  if (!fs.existsSync(options.browser)) throw new Error('Explicit browser does not exist');
  process.env.HYPERFRAMES_BROWSER_PATH = options.browser;
  report.shared_browser = options.browser;
}
function run(file, commandArgs, cwd = options.toolchain, timeout = 120000) {
  let result;
  if (windows && file.endsWith('.cmd')) {
    if (!path.isAbsolute(file)) {
      const resolved = (process.env.PATH || '').split(path.delimiter).map(dir => path.join(dir.replace(/^"|"$/g, ''), file)).find(candidate => fs.existsSync(candidate));
      if (resolved) file = resolved;
    }
    // Only fixed CLI arguments are passed through cmd. Paths stay quoted; reject shell metacharacters.
    for (const value of [file, ...commandArgs]) if (/["&|<>^%\r\n]/.test(value)) throw new Error('Unsafe cmd argument');
    const line = `""${file}" ${commandArgs.map(x => `"${x}"`).join(' ')}"`;
    result = spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', line], {cwd, encoding: 'utf8', windowsHide: true, windowsVerbatimArguments: true, timeout, maxBuffer: 8 * 1024 * 1024});
  } else result = spawnSync(file, commandArgs, {cwd, encoding: 'utf8', windowsHide: true, timeout, maxBuffer: 8 * 1024 * 1024});
  return {ok: result.status === 0 && !result.error, exit_code: result.status, stdout: result.stdout || '', stderr: result.stderr || '', error: result.error?.message || null};
}
function record(name, result, extra = {}) {
  report.checks[name] = {ok: result.ok, ...extra, exit_code: result.exit_code, detail: (result.error || result.stdout || result.stderr).trim().slice(-10000)};
  console.log(`${result.ok ? 'OK' : 'FAIL'} ${name}${extra.version ? ` ${extra.version}` : ''}`);
}
function save() {
  report.ok = ['node', 'npm', 'ffmpeg', 'ffprobe', 'packages', 'remotion_cli', 'remotion_browser', 'remotion_browser_launch', 'hyperframes_cli', 'hyperframes_browser', 'hyperframes_doctor'].every(k => report.checks[k]?.ok);
  if (options.report) {fs.mkdirSync(path.dirname(options.report), {recursive: true}); fs.writeFileSync(options.report, JSON.stringify(report, null, 2) + '\n');}
  console.log(`Readiness: ${report.ok ? 'PASS' : 'FAIL'}`);
  process.exitCode = report.ok ? 0 : 1;
}
const systemCwd = process.cwd();
record('node', {ok: Number(process.versions.node.split('.')[0]) >= 22, exit_code: 0, stdout: process.version}, {version: process.version, requirement: '>=22'});
record('npm', run(windows ? 'npm.cmd' : 'npm', ['--version'], systemCwd));
for (const binary of ['ffmpeg', 'ffprobe']) record(binary, run(binary, ['-version'], systemCwd));
if (!report.checks.node.ok || !report.checks.npm.ok) {save();} else {
  const packageFile = path.join(options.toolchain, 'package.json');
  if (options.install && !fs.existsSync(packageFile)) {
    fs.mkdirSync(options.toolchain, {recursive: true});
    fs.writeFileSync(packageFile, JSON.stringify({name: 'talking-head-studio-toolchain', private: true, version: '2.0.0', dependencies: {'remotion': '4.0.535', '@remotion/cli': '4.0.535', '@remotion/renderer': '4.0.535', 'hyperframes': '0.8.151', 'react': '19.2.0', 'react-dom': '19.2.0'}}, null, 2) + '\n');
  }
  function packages() {
    const versions = {};
    for (const name of ['remotion', '@remotion/cli', '@remotion/renderer', 'hyperframes', 'react', 'react-dom']) {
      try {versions[name] = JSON.parse(fs.readFileSync(path.join(options.toolchain, 'node_modules', name, 'package.json'), 'utf8')).version;} catch {versions[name] = null;}
    }
    const consistent = versions.remotion === versions['@remotion/cli'] && versions.remotion === versions['@remotion/renderer'];
    return {ok: Object.values(versions).every(Boolean) && consistent, versions};
  }
  let installed = packages();
  if (!installed.ok && options.install) {
    console.log('Installing isolated toolchain (existing manifest and lockfile are preserved)...');
    const lock = fs.existsSync(path.join(options.toolchain, 'package-lock.json'));
    const install = run(windows ? 'npm.cmd' : 'npm', [lock ? 'ci' : 'install', '--no-audit', '--no-fund'], options.toolchain, 1200000);
    record('installation', install);
    installed = packages();
  }
  record('packages', {ok: installed.ok, exit_code: installed.ok ? 0 : 1, stdout: JSON.stringify(installed.versions)}, {versions: installed.versions});
  if (installed.ok) {
    const bin = name => path.join(options.toolchain, 'node_modules', '.bin', name + (windows ? '.cmd' : ''));
    record('remotion_cli', run(bin('remotion'), ['versions']));
    record('hyperframes_cli', run(bin('hyperframes'), ['--version']));
    if (options.install) {
      console.log('Ensuring Remotion render browser...');
      record('remotion_browser_ensure', run(bin('remotion'), ['browser', 'ensure'], options.toolchain, 1200000));
    }
    const checkBrowser = run(process.execPath, ['--input-type=module', '-e', "import {ensureBrowser} from '@remotion/renderer'; const browser=await ensureBrowser({onBrowserDownload:()=>{throw new Error('Browser missing or incompatible; rerun with --install')}}); console.log(browser.path);"], options.toolchain);
    record('remotion_browser', checkBrowser);
    if (checkBrowser.ok && !process.env.HYPERFRAMES_BROWSER_PATH) {
      const sharedBrowser = checkBrowser.stdout.trim().split(/\r?\n/).at(-1);
      if (sharedBrowser && fs.existsSync(sharedBrowser)) {
        process.env.HYPERFRAMES_BROWSER_PATH = sharedBrowser;
        report.shared_browser = sharedBrowser;
      }
    }
    if (report.checks.remotion_browser?.ok) {
      record('remotion_browser_launch', run(process.execPath, ['--input-type=module', '-e', "import {openBrowser} from '@remotion/renderer'; const browser=await openBrowser('chrome',{onBrowserDownload:()=>{throw new Error('Browser missing')}}); await browser.close({silent:true}); console.log('Browser launched and closed');"], options.toolchain));
    }
    if (options.install) {
      console.log('Ensuring HyperFrames render browser...');
      record('hyperframes_browser_ensure', run(bin('hyperframes'), ['browser', 'ensure'], options.toolchain, 1200000));
    }
    const hfBrowser = run(bin('hyperframes'), ['browser', 'path']);
    const browserPath = hfBrowser.stdout.trim().split(/\r?\n/).at(-1);
    hfBrowser.ok = hfBrowser.ok && Boolean(browserPath) && fs.existsSync(browserPath);
    record('hyperframes_browser', hfBrowser);
    const doctor = run(bin('hyperframes'), ['doctor', '--json']);
    let payload = null;
    try {payload = JSON.parse(doctor.stdout);} catch {
      const start = doctor.stdout.indexOf('{'); const end = doctor.stdout.lastIndexOf('}');
      try {payload = JSON.parse(doctor.stdout.slice(start, end + 1));} catch {}
    }
    const requiredChecks = ['Node.js', 'FFmpeg', 'FFprobe', 'Chrome'];
    const localReady = requiredChecks.every(name => payload?.checks?.find(check => check.name === name)?.ok === true);
    doctor.ok = doctor.ok && typeof payload?.ok === 'boolean' && localReady;
    record('hyperframes_doctor', doctor, {all_checks_ok: payload?.ok ?? null, required_checks: requiredChecks, payload});
  }
  save();
}
