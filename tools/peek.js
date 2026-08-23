#!/usr/bin/env node
// peek.js <file> <var...> — in ra các lần dùng biến, kèm ngữ cảnh ngắn (tránh nổ context).
const fs = require('fs');
const file = process.argv[2];
const vars = process.argv.slice(3);
const src = fs.readFileSync(file, 'utf8');
const W = Number(process.env.PEEK_W || 70);
const MAX = Number(process.env.PEEK_MAX || 6);
for (const v of vars) {
  console.log('### ' + v);
  const re = new RegExp(v.replace(/[$]/g, '\\$'), 'g');
  let m, n = 0;
  while ((m = re.exec(src)) && n < MAX) {
    const s = Math.max(0, m.index - W);
    const e = Math.min(src.length, m.index + v.length + W);
    const line = src.slice(0, m.index).split('\n').length;
    console.log('  L' + line + ': ' + src.slice(s, e).replace(/\s+/g, ' '));
    n++;
  }
  if (!n) console.log('  (không thấy)');
}
