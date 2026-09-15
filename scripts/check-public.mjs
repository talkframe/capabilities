#!/usr/bin/env node
// @ts-check
import {lstat, readFile, readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const OMIT_DIRS = new Set(['.git', 'node_modules']);
const FORBIDDEN_DIRS = new Set(['src', 'jobs']);
const BRAND_PATTERN = new RegExp(['get', 'tr'].join(''), 'iu');
const privateUserDirectory = ['Us', 'ers'].join('');
const PRIVATE_PATH_PATTERNS = [
  {code: 'PRIVATE_MAC_PATH', pattern: new RegExp(`/${privateUserDirectory}/[^/\\s"']+/`, 'u')},
  {code: 'PRIVATE_LINUX_PATH', pattern: new RegExp(`/${['ho', 'me'].join('')}/[^/\\s"']+/`, 'u')},
  {code: 'PRIVATE_WINDOWS_PATH', pattern: new RegExp(`[A-Za-z]:[\\\\/]${privateUserDirectory}[\\\\/][^\\\\/\\s"']+[\\\\/]`, 'u')}
];

/** @param {string} root @param {string} current @returns {Promise<string[]>} */
async function listFiles(root, current = root) {
  const entries = await readdir(current, {withFileTypes: true});
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (OMIT_DIRS.has(entry.name)) continue;
    const absolute = path.join(current, entry.name);
    const relative = path.relative(root, absolute).split(path.sep).join('/');
    if (entry.isSymbolicLink()) {
      files.push(`@symlink:${relative}`);
    } else if (entry.isDirectory()) {
      files.push(...await listFiles(root, absolute));
    } else if (entry.isFile()) {
      files.push(relative);
    }
  }
  return files;
}

/**
 * Check the generated public repository without executing any exported content.
 * @param {string} root
 * @returns {Promise<{ok:boolean, errors:Array<{path:string,code:string,message:string}>}>}
 */
export async function scanPublicRepository(root) {
  const absoluteRoot = path.resolve(root);
  const errors = [];
  for (const entry of await listFiles(absoluteRoot)) {
    if (entry.startsWith('@symlink:')) {
      const relative = entry.slice('@symlink:'.length);
      errors.push({path: relative, code: 'SYMLINK_NOT_ALLOWED', message: '公开仓库不接受符号链接'});
      continue;
    }
    const segments = entry.split('/');
    const forbiddenDirectory = segments.find(segment => FORBIDDEN_DIRS.has(segment));
    if (forbiddenDirectory) errors.push({path: entry, code: 'PRIVATE_DIRECTORY', message: `公开仓库不应包含 ${forbiddenDirectory}/`});
    if (entry.startsWith('capabilities/outro.brand/')) errors.push({path: entry, code: 'BRAND_CAPABILITY', message: '专属品牌能力不得导出'});
    if (entry.startsWith('capabilities/') && /\.(?:[cm]?[jt]s|jsx|tsx)$/iu.test(entry)) errors.push({path: entry, code: 'CAPABILITY_CODE', message: '能力目录不得包含可执行代码'});

    const bytes = await readFile(path.join(absoluteRoot, entry));
    const texts = [bytes.toString('utf8')];
    if (bytes.includes(0)) texts.push(bytes.toString('utf16le'));
    if (texts.some(text => BRAND_PATTERN.test(text))) errors.push({path: entry, code: 'BRAND_TEXT', message: '文件包含专属品牌文字'});
    for (const check of PRIVATE_PATH_PATTERNS) {
      if (texts.some(text => check.pattern.test(text))) errors.push({path: entry, code: check.code, message: '文件包含私人绝对路径'});
    }
  }
  errors.sort((a, b) => `${a.path}/${a.code}`.localeCompare(`${b.path}/${b.code}`));
  return {ok: errors.length === 0, errors};
}

const ownPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === ownPath) {
  const target = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
  try {
    await lstat(target);
    const result = await scanPublicRepository(target);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (!result.ok) process.exitCode = 1;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
