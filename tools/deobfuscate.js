#!/usr/bin/env node
/**
 * Deobfuscator cho javascript-obfuscator (biến thể string-array + rotation).
 *
 * Dùng: node tools/deobfuscate.js <input> <output> [--license-rename]
 *
 * Các pass:
 *   1. Dựng bảng tra string array (chạy rotation IIFE thật để lấy đúng thứ tự)
 *   2. Inline mọi lời gọi decoder  ->  string literal
 *   3. Fold biểu thức hex arithmetic
 *   4. Chuẩn hoá ['prop'] -> .prop, !![] -> true, ![] -> false
 *   5. Xoá dead code (array fn, decoder fn, rotation IIFE, alias rác)
 *   6. Đổi tên khối license (chỉ khi có --license-rename)
 *   7. Sinh code
 */
'use strict';

const fs = require('fs');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const t = require('@babel/types');

const IS_OBF_NAME = /^_0x[0-9a-fA-F]+$/;
const VALID_IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/** Tên biến khối license -> tên có nghĩa. Chỉ đổi tên, không đổi giá trị. */
const LICENSE_RENAMES = {
  _cyval: 'xorDecode',
  _gqeod: 'cyrb53Hash',
  _oyxwu: 'isValidLicenseKey',
  _omcjj: 'getLicenseState',
  _exbk: '_licenseCache',
  _rzyj: '_cachedEmail',
};

/** Tách <script> wrapper nếu input là file .html. */
function splitWrapper(raw) {
  const open = raw.indexOf('<script>');
  const close = raw.lastIndexOf('</script>');
  if (open === -1 || close === -1) return { prefix: '', code: raw, suffix: '' };
  return {
    prefix: raw.slice(0, open + '<script>'.length),
    code: raw.slice(open + '<script>'.length, close),
    suffix: raw.slice(close),
  };
}

/**
 * Nhận diện 3 bộ phận của obfuscator ở top-level:
 *   arrayFn   - function _0xNNNN() { const a = [...]; ... return a; }
 *   decoderFn - function _0xNNNN(idx, key) { idx = idx - N; ... }
 *   rotation  - (function(a, b) { ... }(arrayFnName, N));
 * Cùng các alias top-level: const _0xAAA = decoderName, ...
 */
function findParts(ast) {
  const body = ast.program.body;
  let arrayFn = null;
  let decoderFn = null;
  let rotation = null;

  body.forEach((node, index) => {
    if (t.isFunctionDeclaration(node) && node.id && IS_OBF_NAME.test(node.id.name)) {
      const hasBigArray = node.body.body.some(
        (stmt) =>
          t.isVariableDeclaration(stmt) &&
          stmt.declarations.some(
            (d) => t.isArrayExpression(d.init) && d.init.elements.length > 50
          )
      );
      if (hasBigArray && node.params.length === 0) arrayFn = { node, index };
      else if (node.params.length === 2) decoderFn = { node, index };
      return;
    }
    if (
      t.isExpressionStatement(node) &&
      t.isCallExpression(node.expression) &&
      t.isFunctionExpression(node.expression.callee) &&
      node.expression.arguments.some((a) => t.isIdentifier(a))
    ) {
      if (!rotation) rotation = { node, index };
    }
  });

  if (!arrayFn) throw new Error('Không tìm thấy hàm string array');
  if (!decoderFn) throw new Error('Không tìm thấy hàm decoder');
  if (!rotation) throw new Error('Không tìm thấy rotation IIFE');
  return { arrayFn, decoderFn, rotation };
}

/** Tập alias của decoder, tính bắc cầu (alias của alias). */
function collectAliases(ast, decoderName) {
  const aliases = new Set([decoderName]);
  let changed = true;
  while (changed) {
    changed = false;
    traverse(ast, {
      VariableDeclarator(path) {
        const { id, init } = path.node;
        if (
          t.isIdentifier(id) &&
          IS_OBF_NAME.test(id.name) &&
          t.isIdentifier(init) &&
          aliases.has(init.name) &&
          !aliases.has(id.name)
        ) {
          aliases.add(id.name);
          changed = true;
        }
      },
    });
  }
  return aliases;
}

/**
 * Dựng bảng tra: chạy arrayFn + decoderFn + alias top-level + rotation IIFE
 * trong một sandbox, rồi gọi decoder. PHẢI chạy rotation, vì nó shift/push
 * mảng lúc runtime — cộng offset thẳng sẽ ra sai chuỗi.
 */
function buildDecoder(ast, parts, aliases) {
  const body = ast.program.body;
  const wanted = new Set([parts.arrayFn.index, parts.decoderFn.index, parts.rotation.index]);

  // Alias top-level đứng trước rotation cũng cần có mặt trong sandbox.
  body.forEach((node, index) => {
    if (index >= parts.rotation.index) return;
    if (!t.isVariableDeclaration(node)) return;
    const isAliasDecl = node.declarations.every(
      (d) => t.isIdentifier(d.init) && aliases.has(d.init.name)
    );
    if (isAliasDecl) wanted.add(index);
  });

  const picked = [...wanted].sort((a, b) => a - b).map((i) => body[i]);
  const src = generate(t.program(picked), { compact: false }).code;
  const decoder = new Function(`${src}\nreturn ${parts.decoderFn.node.id.name};`)();

  const cache = new Map();
  return function decode(index) {
    if (!cache.has(index)) cache.set(index, decoder(index));
    return cache.get(index);
  };
}

/** Pass 2: inline lời gọi decoder/alias với 1 tham số số -> string literal. */
function inlineDecoderCalls(ast, aliases, decode, stats) {
  traverse(ast, {
    CallExpression(path) {
      const { callee, arguments: args } = path.node;
      if (!t.isIdentifier(callee) || !aliases.has(callee.name)) return;
      if (args.length < 1 || !t.isNumericLiteral(args[0])) return;
      const value = decode(args[0].value);
      if (typeof value !== 'string') return;
      path.replaceWith(t.stringLiteral(value));
      stats.inlined++;
    },
  });
}

/** Đánh giá cây biểu thức chỉ gồm số literal. Trả undefined nếu không thuần số. */
function evalNumeric(node) {
  if (t.isNumericLiteral(node)) return node.value;
  if (t.isUnaryExpression(node) && (node.operator === '-' || node.operator === '+')) {
    const inner = evalNumeric(node.argument);
    if (inner === undefined) return undefined;
    return node.operator === '-' ? -inner : inner;
  }
  if (t.isBinaryExpression(node) && ['+', '-', '*'].includes(node.operator)) {
    const left = evalNumeric(node.left);
    const right = evalNumeric(node.right);
    if (left === undefined || right === undefined) return undefined;
    const out = node.operator === '+' ? left + right : node.operator === '-' ? left - right : left * right;
    // Chỉ fold khi kết quả còn chính xác tuyệt đối.
    if (!Number.isSafeInteger(out)) return undefined;
    return out;
  }
  return undefined;
}

/** Pass 3: fold `-0x8*-0xb3+-0x18ae+...` -> `40`. */
function foldNumbers(ast, stats) {
  traverse(ast, {
    'BinaryExpression|UnaryExpression': {
      exit(path) {
        if (t.isNumericLiteral(path.node)) return;
        // Bỏ qua unary '-' bọc sẵn 1 số: đó đã là dạng gọn nhất.
        if (
          t.isUnaryExpression(path.node) &&
          path.node.operator === '-' &&
          t.isNumericLiteral(path.node.argument)
        ) {
          return;
        }
        const value = evalNumeric(path.node);
        if (value === undefined) return;
        path.replaceWith(
          value < 0
            ? t.unaryExpression('-', t.numericLiteral(-value))
            : t.numericLiteral(value)
        );
        path.skip();
        stats.folded++;
      },
    },
  });
}

/** Pass 4: ['prop'] -> .prop, {'k':v} -> {k:v}, ![] -> false, !![] -> true. */
function normalize(ast, stats) {
  traverse(ast, {
    'MemberExpression|OptionalMemberExpression'(path) {
      const node = path.node;
      if (!node.computed || !t.isStringLiteral(node.property)) return;
      if (!VALID_IDENT.test(node.property.value)) return;
      node.computed = false;
      node.property = t.identifier(node.property.value);
      stats.members++;
    },
    ObjectProperty(path) {
      const node = path.node;
      if (node.computed || !t.isStringLiteral(node.key)) return;
      if (!VALID_IDENT.test(node.key.value)) return;
      node.key = t.identifier(node.key.value);
    },
    // Bỏ `extra.raw` để generator in lại chuỗi theo giá trị thật,
    // thay vì giữ nguyên escape `\x20` của bản obfuscate. Chỉ đổi cách
    // viết, giá trị chuỗi không đổi.
    StringLiteral(path) {
      delete path.node.extra;
    },
    UnaryExpression: {
      exit(path) {
        const node = path.node;
        if (node.operator !== '!') return;
        const arg = node.argument;
        if (t.isArrayExpression(arg) && arg.elements.length === 0) {
          path.replaceWith(t.booleanLiteral(false));
          stats.bools++;
        } else if (t.isBooleanLiteral(arg)) {
          path.replaceWith(t.booleanLiteral(!arg.value));
          stats.bools++;
        } else if (t.isNumericLiteral(arg) && (arg.value === 0 || arg.value === 1)) {
          path.replaceWith(t.booleanLiteral(!arg.value));
          stats.bools++;
        }
      },
    },
  });
}

/** Pass 5: xoá array fn, decoder fn, rotation IIFE và alias không còn ai dùng. */
function removeDeadCode(ast, parts, aliases, stats) {
  const doomed = new Set([parts.arrayFn.node, parts.decoderFn.node, parts.rotation.node]);
  traverse(ast, {
    Program(path) {
      path.get('body').forEach((stmt) => {
        if (doomed.has(stmt.node)) {
          stmt.remove();
          stats.deadStatements++;
        }
      });
    },
  });

  // Alias trỏ vào alias, nên phải xoá theo vòng lặp: bỏ lớp ngoài trước,
  // lớp trong mới về 0 tham chiếu. Chạy tới khi không xoá được gì nữa.
  for (;;) {
    const refs = new Map();
    traverse(ast, {
      Identifier(path) {
        if (!aliases.has(path.node.name)) return;
        const parent = path.parent;
        if (t.isVariableDeclarator(parent) && parent.id === path.node) return;
        if (t.isMemberExpression(parent) && !parent.computed && parent.property === path.node) return;
        if (t.isObjectProperty(parent) && !parent.computed && parent.key === path.node) return;
        refs.set(path.node.name, (refs.get(path.node.name) || 0) + 1);
      },
    });

    let removed = 0;
    traverse(ast, {
      VariableDeclaration(path) {
        const keep = path.node.declarations.filter((d) => {
          const isAlias =
            t.isIdentifier(d.id) && aliases.has(d.id.name) && t.isIdentifier(d.init);
          if (!isAlias) return true;
          if ((refs.get(d.id.name) || 0) > 0) return true;
          removed++;
          return false;
        });
        if (keep.length === path.node.declarations.length) return;
        if (keep.length === 0) path.remove();
        else path.node.declarations = keep;
      },
    });

    stats.aliasesRemoved += removed;
    if (removed === 0) break;
  }
}


/** Pass 6: đổi tên khối license. Chỉ đổi tên định danh, không đổi giá trị. */
function renameLicense(ast, stats) {
  traverse(ast, {
    Identifier(path) {
      const next = LICENSE_RENAMES[path.node.name];
      if (!next) return;
      const parent = path.parent;
      if (t.isMemberExpression(parent) && !parent.computed && parent.property === path.node) return;
      if (t.isObjectProperty(parent) && !parent.computed && parent.key === path.node) return;
      path.node.name = next;
      stats.renamed++;
    },
  });
}

function main() {
  const [input, output, ...flags] = process.argv.slice(2);
  if (!input || !output) {
    console.error('Dùng: node tools/deobfuscate.js <input> <output> [--license-rename]');
    process.exit(1);
  }
  const doRename = flags.includes('--license-rename');
  const raw = fs.readFileSync(input, 'utf8');
  const { prefix, code, suffix } = splitWrapper(raw);

  const ast = parser.parse(code, { sourceType: 'script', errorRecovery: false });
  const parts = findParts(ast);
  const aliases = collectAliases(ast, parts.decoderFn.node.id.name);
  const decode = buildDecoder(ast, parts, aliases);

  const stats = {
    inlined: 0, folded: 0, members: 0, bools: 0,
    deadStatements: 0, aliasesRemoved: 0, renamed: 0,
  };

  inlineDecoderCalls(ast, aliases, decode, stats);
  foldNumbers(ast, stats);
  normalize(ast, stats);
  removeDeadCode(ast, parts, aliases, stats);
  if (doRename) renameLicense(ast, stats);

  const out = generate(ast, {
    compact: false,
    retainLines: false,
    comments: true,
    jsescOption: { minimal: true },
  }).code;

  fs.writeFileSync(output, prefix ? `${prefix}\n${out}\n${suffix}` : `${out}\n`, 'utf8');

  console.log(`${input} -> ${output}`);
  console.log(`  decoder: ${parts.decoderFn.node.id.name}  array: ${parts.arrayFn.node.id.name}`);
  console.log(`  alias: ${[...aliases].join(', ')}`);
  Object.entries(stats).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
}

if (require.main === module) main();

module.exports = { splitWrapper, LICENSE_RENAMES };




