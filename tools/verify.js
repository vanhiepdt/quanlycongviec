#!/usr/bin/env node
/**
 * Kiểm tra bản dịch có giữ đúng mọi chuỗi mà bản obfuscate dùng.
 *
 * Dùng: node tools/verify.js <original> <clean>
 *
 * Cách làm: giải mã mọi lời gọi decoder trong bản gốc (bỏ phần rotation IIFE,
 * vì các chuỗi checksum trong đó là dead code sau khi inline), rồi đối chiếu
 * với mọi chuỗi + tên property trong bản dịch.
 */
'use strict';

const fs = require('fs');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const t = require('@babel/types');
const { splitWrapper } = require('./deobfuscate.js');

function sliceFn(src, header, tail) {
  const start = src.indexOf(header);
  if (start === -1) throw new Error(`Không tìm thấy: ${header}`);
  const end = src.indexOf(tail, start);
  if (end === -1) throw new Error(`Không tìm thấy đuôi: ${tail}`);
  return src.slice(start, end + tail.length);
}

/** Dựng lại decoder của bản gốc bằng cách chạy thật cả rotation. */
function originalDecoder(code) {
  const arrayName = code.match(/}\((_0x[0-9a-f]+),/)[1];
  const arrayFn = sliceFn(code, `function ${arrayName}()`, `return ${arrayName}();}`);
  const decMatch = code.match(/function (_0x[0-9a-f]+)\((_0x[0-9a-f]+),_0x[0-9a-f]+\)\{\2=\2-/);
  const decName = decMatch[1];
  const decRet = code.slice(code.indexOf(`function ${decName}(`)).match(/return (_0x[0-9a-f]+);}/)[1];
  const decFn = sliceFn(code, `function ${decName}(`, `return ${decRet};}`);
  const iifeAt = code.indexOf(`}(${arrayName},`);
  const iifeEnd = code.indexOf('));', iifeAt) + 3;
  const prelude = code.slice(0, iifeEnd);
  const fn = new Function(`${arrayFn}\n${decFn}\n${prelude}\nreturn ${decName};`)();
  return { decode: fn, iifeEnd };
}

/** Mọi chuỗi bản dịch dùng: string literal + tên property + key object. */
function stringsOf(code) {
  const ast = parser.parse(code, { sourceType: 'script' });
  const seen = new Set();
  traverse(ast, {
    StringLiteral(path) {
      seen.add(path.node.value);
    },
    'MemberExpression|OptionalMemberExpression'(path) {
      const { computed, property } = path.node;
      if (!computed && t.isIdentifier(property)) seen.add(property.name);
    },
    ObjectProperty(path) {
      if (!path.node.computed && t.isIdentifier(path.node.key)) seen.add(path.node.key.name);
    },
  });
  return seen;
}

function functionNames(code) {
  return new Set(
    [...code.matchAll(/function ([A-Za-z_$][\w$]*)\s*\(/g)]
      .map((m) => m[1])
      .filter((n) => !/^_0x/.test(n))
  );
}

function main() {
  const [originalPath, cleanPath] = process.argv.slice(2);
  const originalCode = splitWrapper(fs.readFileSync(originalPath, 'utf8')).code;
  const cleanCode = splitWrapper(fs.readFileSync(cleanPath, 'utf8')).code;

  const { decode, iifeEnd } = originalDecoder(originalCode);
  const outside = originalCode.slice(iifeEnd);
  const indices = new Set(
    [...outside.matchAll(/_0x[0-9a-f]{4,8}\((0x[0-9a-f]+)\)/g)].map((m) => parseInt(m[1], 16))
  );
  const expected = new Set([...indices].map(decode));

  const got = stringsOf(cleanCode);
  const missing = [...expected].filter((s) => !got.has(s));

  const origFns = functionNames(originalCode);
  const cleanFns = functionNames(cleanCode);
  const lostFns = [...origFns].filter((n) => !cleanFns.has(n));

  const residual = {
    'decoder call': (cleanCode.match(/_0x[0-9a-f]{4,8}\(0x[0-9a-f]+\)/g) || []).length,
    'hex arithmetic': (cleanCode.match(/-?0x[0-9a-f]+\s*[*+]\s*-?0x[0-9a-f]+/g) || []).length,
    '![]': (cleanCode.match(/!\[\]/g) || []).length,
  };

  console.log(`${originalPath} vs ${cleanPath}`);
  console.log(`  chuỗi cần có   : ${expected.size}`);
  console.log(`  thiếu          : ${missing.length}${missing.length ? ' ' + JSON.stringify(missing.slice(0, 15)) : ''}`);
  console.log(`  function gốc   : ${origFns.size}, mất: ${lostFns.length}${lostFns.length ? ' ' + JSON.stringify(lostFns) : ''}`);
  Object.entries(residual).forEach(([k, v]) => console.log(`  còn sót ${k}: ${v}`));

  const ok = missing.length === 0 && lostFns.length === 0 && Object.values(residual).every((v) => v === 0);
  console.log(ok ? '  => PASS' : '  => FAIL');
  process.exit(ok ? 0 : 1);
}

main();
