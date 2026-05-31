const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eb-test-'));
const outFile = path.join(tmpDir, 'output.json');
const outStream = fs.createWriteStream(outFile);

console.log('=== 模拟 electron-builder: child.stdout.pipe(writeStream) ===');
const child = spawn('cmd.exe', ['/c', 'echo {"version":"1.0.0"}'], { shell: true });
console.log('child.stdout:', child.stdout ? 'Readable' : 'null');

child.stdout.pipe(outStream);

let stderr = '';
child.stderr.on('data', chunk => { stderr += chunk.toString(); });

child.on('error', err => {
  console.log('SPAWN ERROR:', err.message);
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch(e) {}
});

child.on('close', code => {
  outStream.close();
  console.log('CLOSE code:', code);
  console.log('stderr:', JSON.stringify(stderr));
  const output = fs.readFileSync(outFile, 'utf8');
  console.log('Captured output:', JSON.stringify(output.trim()));
  if (output.includes('1.0.0')) {
    console.log('SUCCESS: pipe()链式调用工作正常!');
  }
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch(e) {}
  setTimeout(() => process.exit(0), 100);
});
