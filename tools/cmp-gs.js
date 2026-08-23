#!/usr/bin/env node
/**
 * cmp-gs.js <a.gs> <b.gs>
 * So sánh hai bản Apps Script ở mức ngữ nghĩa (bỏ qua format/tên biến cục bộ):
 *   - parse được không
 *   - danh sách hàm top-level + số tham số
 *   - tập chuỗi ký tự
 *   - tập identifier tự do (biến/hàm toàn cục được tham chiếu)
 *   - tập tên property được truy cập
 */
'use strict';
const fs = require('fs');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

function load(file) {
  const src = fs.readFileSync(file, 'utf8');
  let ast;
  try {
    ast = parser.parse(src, { sourceType: 'script', errorRecovery: false });
  } catch (e) {
    return { file, error: `${e.message}` };
  }
  const fns = new Map();
  const strings = new Set();
  const props = new Set();
  let globals = [];
  traverse(ast, {
    Program(p) { globals = Object.keys(p.scope.globals).sort(); },
    FunctionDeclaration(p) {
      if (p.parentPath.isProgram() && p.node.id) fns.set(p.node.id.name, p.node.params.length);
    },
    StringLiteral(p) { strings.add(p.node.value); },
    MemberExpression(p) { if (!p.node.computed && p.node.property.name) props.add(p.node.property.name); },
    ObjectProperty(p) { if (!p.node.computed && p.node.key && p.node.key.name) props.add(p.node.key.name); },
  });
  return { file, fns, strings, props, globals: new Set(globals), bytes: src.length };
}

const A = load(process.argv[2]);
const B = load(process.argv[3]);
for (const x of [A, B]) {
  if (x.error) { console.log(`PARSE LỖI ${x.file}: ${x.error}`); process.exit(1); }
  console.log(`${x.file}: parse OK, ${x.fns.size} hàm top-level, ${x.strings.size} chuỗi, ${x.globals.size} identifier tự do`);
}
const diffSet = (label, a, b) => {
  const onlyA = [...a].filter((x) => !b.has(x));
  const onlyB = [...b].filter((x) => !a.has(x));
  console.log(`\n${label}`);
  console.log(`  chỉ có ở A (${onlyA.length}): ${onlyA.slice(0, 40).join(', ') || '-'}`);
  console.log(`  chỉ có ở B (${onlyB.length}): ${onlyB.slice(0, 40).join(', ') || '-'}`);
};
diffSet('HÀM TOP-LEVEL', new Set(A.fns.keys()), new Set(B.fns.keys()));
const arity = [...A.fns.keys()].filter((n) => B.fns.has(n) && A.fns.get(n) !== B.fns.get(n));
console.log(`  khác số tham số (${arity.length}): ${arity.map((n) => `${n}: ${A.fns.get(n)}->${B.fns.get(n)}`).join(', ') || '-'}`);
diffSet('IDENTIFIER TỰ DO (global)', A.globals, B.globals);
diffSet('TÊN PROPERTY', A.props, B.props);
const sa = [...A.strings].filter((s) => !B.strings.has(s));
const sb = [...B.strings].filter((s) => !A.strings.has(s));
console.log(`\nCHUỖI KÝ TỰ`);
console.log(`  mất ở B (${sa.length}): ${sa.slice(0, 25).map((s) => JSON.stringify(s.slice(0, 60))).join(' | ') || '-'}`);
console.log(`  thêm ở B (${sb.length}): ${sb.slice(0, 25).map((s) => JSON.stringify(s.slice(0, 60))).join(' | ') || '-'}`);
