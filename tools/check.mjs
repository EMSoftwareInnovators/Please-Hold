/* Runs every automated check: the call-script validator (no browser needed),
   then the boot check, the per-call soak and the full playthrough against a
   real headless browser. Boots its own static server. */
import { spawn } from 'node:child_process';

const run = (cmd, args) => new Promise((res) => {
  const p = spawn(cmd, args, { stdio: 'inherit' });
  p.on('exit', (code) => res(code || 0));
});

const server = spawn(process.execPath, ['serve.cjs'], {
  stdio: 'ignore',
  env: { ...process.env, PORT: process.env.PORT || '8080' },
});
await new Promise((r) => setTimeout(r, 900));

let failed = 0;
for (const t of ['tools/calls.mjs', 'tools/boot.mjs', 'tools/audio.mjs', 'tools/soak.mjs', 'tools/tutorial.mjs', 'tools/controls.mjs', 'tools/playthrough.mjs']) {
  console.log(`\n===== ${t} =====`);
  failed += await run(process.execPath, [t]);
}
server.kill();
console.log(failed ? '\nCHECKS FAILED' : '\nALL CHECKS PASSED');
process.exit(failed ? 1 : 0);
