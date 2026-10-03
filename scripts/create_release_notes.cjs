'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const version = JSON.parse(fs.readFileSync(path.join(root, 'electron-app', 'package.json'), 'utf8')).version;
const source = path.join(root, 'docs', 'releases', 'v' + version + '.md');
if (!fs.existsSync(source)) throw new Error('Release notes missing: ' + version);
fs.writeFileSync(path.join(root, 'electron-app', 'release-notes.md'), fs.readFileSync(source, 'utf8'), 'utf8');
