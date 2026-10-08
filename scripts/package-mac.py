#!/usr/bin/env python3
"""Assemble a macOS test ZIP on any OS, preserving Unix modes and symlinks."""
import argparse
import copy
import hashlib
import json
import plistlib
import posixpath
import stat
import struct
import zipfile
from pathlib import Path


def renamed(name, product):
    parts = name.split('/')
    for i, part in enumerate(parts):
        if part == 'Electron.app':
            parts[i] = product + '.app'
        elif part.startswith('Electron Helper') or part.startswith('Electron Login Helper'):
            parts[i] = product + part[len('Electron'):]
        elif part == 'Electron' and i > 0 and parts[i - 1] == 'MacOS':
            parts[i] = product
    return '/'.join(parts)


def put(archive, name, data, mode=0o644):
    info = zipfile.ZipInfo(name)
    info.create_system = 3
    info.external_attr = (stat.S_IFREG | mode) << 16
    info.compress_type = zipfile.ZIP_DEFLATED
    archive.writestr(info, data)


def build(args):
    product = args.product
    app = product + '.app'
    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=True)
    # Cross-built ZIPs have a distinct name from native, ad-hoc signed releases.
    target = output / f'Snode-RPG-{args.version}-mac-{args.arch}-test.zip'
    with zipfile.ZipFile(args.runtime) as runtime, zipfile.ZipFile(target, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
        for original in runtime.infolist():
            name = original.filename
            if '/_CodeSignature/' in name or name.rstrip('/').endswith('/_CodeSignature'):
                continue
            if name.endswith('/Resources/default_app.asar'):
                continue
            data = runtime.read(original)
            dest = renamed(name, product)
            mode = original.external_attr >> 16
            # Update app/helper bundle metadata; framework plists stay intact.
            if name.endswith('.app/Contents/Info.plist'):
                info = plistlib.loads(data)
                executable = info.get('CFBundleExecutable', '')
                info['CFBundleExecutable'] = renamed('MacOS/' + executable, product).split('/')[-1]
                info['CFBundleName'] = product + str(info.get('CFBundleName', 'Electron'))[len('Electron'):]
                info['CFBundleDisplayName'] = info['CFBundleName']
                info['CFBundleShortVersionString'] = args.version
                info['CFBundleVersion'] = args.version
                if name == 'Electron.app/Contents/Info.plist':
                    info['CFBundleIdentifier'] = args.app_id
                    info['LSApplicationCategoryType'] = 'public.app-category.games'
                else:
                    suffix = executable.removeprefix('Electron').strip().lower()
                    suffix = suffix.replace(' ', '.').replace('(', '').replace(')', '')
                    info['CFBundleIdentifier'] = args.app_id + '.' + suffix
                info.pop('ElectronAsarIntegrity', None)
                data = plistlib.dumps(info)
            if stat.S_ISLNK(mode):
                # Stock framework links are relative. Renaming helper paths must
                # also rename their link targets while retaining symlink modes.
                data = renamed(data.decode('utf-8'), product).encode('utf-8')
            info = copy.copy(original)
            info.filename = dest
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, data)
        put(archive, app + '/Contents/Resources/app.asar', Path(args.payload).read_bytes())
        for file in sorted(Path(args.extras).rglob('*')):
            if file.is_file():
                name = file.relative_to(args.extras).as_posix()
                put(archive, app + '/Contents/' + name, file.read_bytes(), 0o755 if name == 'snode' else 0o644)
        command = f'''#!/bin/bash
set -euo pipefail
SNODE_PACKAGE_DIR="$(cd -- "$(dirname -- "$0")" && pwd)"
SNODE_APP_PATH="$SNODE_PACKAGE_DIR/{app}"
if [ ! -d "$SNODE_APP_PATH" ]; then
  echo "请将首次运行.command 与 {app} 放在同一个文件夹。"
  exit 1
fi
echo "正在为本机签名斯诺德跑团测试版..."
/usr/bin/xattr -dr com.apple.quarantine "$SNODE_APP_PATH"
/usr/bin/codesign --force --deep --sign - "$SNODE_APP_PATH"
/usr/bin/codesign --verify --deep --strict "$SNODE_APP_PATH"
/usr/bin/open "$SNODE_APP_PATH"
echo "已启动。以后可以直接打开 {app}。"
'''
        put(archive, '首次运行.command', command.encode('utf-8'), 0o755)
        readme = f'''斯诺德跑团 {args.version} · macOS {args.arch} 测试版

适用机型：{'Apple 芯片 Mac（M 系列），macOS 11 或更新' if args.arch == 'arm64' else 'Intel Mac，macOS 10.13 或更新'}。

1. 在 Mac 上使用系统的“归档实用工具”解压 ZIP。
2. 解压后，在终端输入 bash 和一个空格，将“首次运行.command”拖入终端，再按回车。
   首次运行脚本仅为本文件夹内的应用清除下载隔离属性并生成本机临时签名，然后打开应用。
3. 启动成功后，可以将 {app} 拖入“应用程序”，以后直接打开。
4. 如需命令行功能，在应用启动后运行：
   "/Applications/{app}/Contents/snode" chargen flow

此包在 Windows 上组装，尚未在真实 Mac 上完成运行验证。它不是 Apple Developer ID 签名或公证版本。
应用和角色资料保存在 ~/Library/Application Support/ 下，更新时退出应用再替换 .app。
AI 顾问需自行配置 API Key；可将应用 Contents/.env.example 复制成 Contents/.env 后填写。
完整标准 DMG 打包方法见仓库 docs/macos-packaging.md。
'''
        put(archive, 'Mac使用说明.txt', readme.encode('utf-8'))
    report = verify(target, args)
    report['sha256'] = hashlib.sha256(target.read_bytes()).hexdigest()
    report['bytes'] = target.stat().st_size
    manifest = target.with_suffix('.manifest.json')
    manifest.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'artifact': str(target), 'MiB': round(report['bytes'] / 1048576, 1),
                      'symlinks': report['symlinks'], 'checks': 'passed'}, ensure_ascii=True))


def verify(target, args):
    app = args.product + '.app'
    with zipfile.ZipFile(target) as archive:
        bad = archive.testzip()
        if bad:
            raise ValueError('ZIP CRC check failed: ' + bad)
        names = set(archive.namelist())
        executable = app + '/Contents/MacOS/' + args.product
        binary = archive.read(executable)
        if binary[:4] != b'\xcf\xfa\xed\xfe':
            raise ValueError('Expected a little-endian 64-bit Mach-O executable')
        cpu_type = struct.unpack_from('<I', binary, 4)[0]
        if cpu_type != {'x64': 0x01000007, 'arm64': 0x0100000c}[args.arch]:
            raise ValueError('Runtime architecture mismatch')
        if not (archive.getinfo(executable).external_attr >> 16) & 0o111:
            raise ValueError('Main executable lost its Unix executable permissions')
        info = plistlib.loads(archive.read(app + '/Contents/Info.plist'))
        assert info['CFBundleIdentifier'] == args.app_id
        assert info['CFBundleExecutable'] == args.product
        assert info['CFBundleShortVersionString'] == args.version
        assert archive.read(app + '/Contents/Resources/app.asar') == Path(args.payload).read_bytes()
        for required in ['Contents/snode', 'Contents/CLI.md', 'Contents/.env.example',
                         'Contents/scripts/snode-cli.mjs', 'Contents/scripts/mage-advisor.mjs']:
            assert app + '/' + required in names, required
        assert not any(name.endswith('/.env') or '/.env.bundle' in name for name in names)
        assert not any('_CodeSignature' in name for name in names)
        links = {member.filename.rstrip('/'): archive.read(member).decode('utf-8')
                 for member in archive.infolist() if stat.S_ISLNK(member.external_attr >> 16)}

        def resolve_link(dest):
            # Framework links frequently pass through Versions/Current -> A.
            for _ in range(40):
                parts = dest.split('/')
                for i in range(1, len(parts) + 1):
                    prefix = '/'.join(parts[:i])
                    if prefix in links:
                        dest = posixpath.normpath(posixpath.join(posixpath.dirname(prefix), links[prefix], *parts[i:]))
                        break
                else:
                    return dest
            raise ValueError('Cyclic framework symlink: ' + dest)

        symlinks = 0
        for member in archive.infolist():
            if stat.S_ISLNK(member.external_attr >> 16):
                symlinks += 1
                dest = posixpath.normpath(posixpath.join(posixpath.dirname(member.filename), archive.read(member).decode('utf-8')))
                dest = resolve_link(dest)
                assert dest.startswith(app + '/'), 'Symlink escaped app bundle: ' + dest
                assert dest in names or dest + '/' in names or any(name.startswith(dest + '/') for name in names), dest
            if member.filename.endswith('.app/Contents/Info.plist'):
                helper = plistlib.loads(archive.read(member))
                binary_path = member.filename.removesuffix('Info.plist') + 'MacOS/' + helper['CFBundleExecutable']
                assert binary_path in names, binary_path
        assert symlinks > 0, 'Framework symlinks missing'
        for name in ['首次运行.command', app + '/Contents/snode']:
            assert (archive.getinfo(name).external_attr >> 16) & 0o111, name
    return {'file': target.name, 'version': args.version, 'arch': args.arch,
            'symlinks': symlinks, 'runtimeVerifiedOnMac': False,
            'signing': 'Requires included first-run command on macOS',
            'checks': ['ZIP CRC', 'Mach-O architecture', 'Unix executable modes',
                       'framework symlinks', 'bundle metadata', 'ASAR payload', 'CLI and advisor files', 'public configuration']}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ['runtime', 'payload', 'extras', 'output', 'version', 'product', 'app-id']:
        parser.add_argument('--' + name, required=True)
    parser.add_argument('--arch', choices=['arm64', 'x64'], required=True)
    build(parser.parse_args())
