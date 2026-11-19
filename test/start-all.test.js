import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {once} from 'node:events';

const launcher = fileURLToPath(new URL('../scripts/start-all.js', import.meta.url));
for (const mode of ['failure', 'shutdown']) {
  test(`unified service: ${mode}`, {timeout: 15000}, async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'eb-unified-'));
    let child;
    try {
      await mkdir(join(cwd, 'bot'));
      await writeFile(join(cwd, 'bot/index.js'), mode === 'failure'
        ? 'setTimeout(()=>process.exit(7),300);'
        : 'console.log("bot ready");setInterval(()=>{},1000);');
      await writeFile(join(cwd, 'server.js'), 'process.on("SIGTERM",()=>{console.log("panel stopped");process.exit(0)});console.log("panel ready");setInterval(()=>{},1000);');
      child = spawn(process.execPath, [launcher], {cwd, stdio: ['ignore', 'pipe', 'pipe']});
      let output = '';
      const ready = new Promise(resolve => child.stdout.on('data', chunk => {
        output += chunk;
        if (output.includes('bot ready') && output.includes('panel ready')) resolve();
      }));
      const exited = once(child, 'exit');
      if (mode === 'shutdown') {
        await ready;
        child.kill('SIGTERM');
      }
      const [code, signal] = await exited;
      assert.equal(signal, null);
      assert.equal(code, mode === 'failure' ? 7 : 0);
      assert.match(output, /panel stopped/);
    } finally {
      if (child && child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
      await rm(cwd, {recursive: true, force: true});
    }
  });
}
