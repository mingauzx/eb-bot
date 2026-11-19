import {spawn} from 'node:child_process';

const children = ['bot/index.js', 'server.js'].map(file =>
  spawn(process.execPath, [file], {stdio: 'inherit'})
);
let stopping = false;

function stop(code) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill('SIGTERM');
  const timer = setTimeout(() => {
    for (const child of children) child.kill('SIGKILL');
    process.exit(code);
  }, 10000);
  Promise.all(children.map(child =>
    child.exitCode !== null || child.signalCode !== null
      ? Promise.resolve()
      : new Promise(resolve => child.once('exit', resolve))
  )).then(() => {
    clearTimeout(timer);
    process.exit(code);
  });
}

for (const child of children) {
  child.on('error', () => stop(1));
  child.on('exit', code => stop(code || 1));
}
process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
