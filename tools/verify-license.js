#!/usr/bin/env node
/**
 * Kiểm tra khối license bản dịch hành xử y hệt bản gốc.
 *
 * Dùng: node tools/verify-license.js
 *
 * Chạy khối license của cả hai bản trong sandbox có mock PropertiesService /
 * Session / ScriptApp, rồi so sánh: 3 lớp anti-tamper, giá trị hash, và cả 3
 * nhánh trả về của cổng license.
 */
'use strict';

const fs = require('fs');

const BOUNDARY = 'const TASK_SHEET_NAME';
const EMAILS = ['a@example.com', 'nguyen.van.a@gsheets.vn', 'HOA@Domain.COM', ''];

function sliceFn(src, header, tail) {
  const start = src.indexOf(header);
  const end = src.indexOf(tail, start);
  return src.slice(start, end + tail.length);
}

/** Bản gốc: cần kèm array fn + decoder fn vì chúng nằm cuối file. */
function originalPrelude(code) {
  const arrayName = code.match(/}\((_0x[0-9a-f]+),/)[1];
  const arrayFn = sliceFn(code, `function ${arrayName}()`, `return ${arrayName}();}`);
  const decName = code.match(/function (_0x[0-9a-f]+)\((_0x[0-9a-f]+),_0x[0-9a-f]+\)\{\2=\2-/)[1];
  const decRet = code.slice(code.indexOf(`function ${decName}(`)).match(/return (_0x[0-9a-f]+);}/)[1];
  const decFn = sliceFn(code, `function ${decName}(`, `return ${decRet};}`);
  return `${arrayFn}\n${decFn}\n${code.slice(0, code.indexOf(BOUNDARY))}`;
}

/** Dựng sandbox: trả về các hàm license đã đặt tên chuẩn hoá. */
function sandbox(prelude, names, storedKey, email) {
  const mocks = `
    var __props = { _lk: ${storedKey === null ? 'undefined' : JSON.stringify(storedKey)} };
    var PropertiesService = {
      getScriptProperties: function () {
        return {
          getProperty: function (k) { return __props[k] === undefined ? null : __props[k]; },
          setProperty: function (k, v) { __props[k] = v; return this; },
        };
      },
    };
    var Session = {
      getEffectiveUser: function () { return { getEmail: function () { return ${JSON.stringify(email)}; } }; },
    };
    var ScriptApp = { getService: function () { return { getUrl: function () { return 'https://example/exec'; } }; } };
  `;
  const expose = `return {
    xorDecode: ${names.xorDecode},
    hash: ${names.hash},
    isValid: ${names.isValid},
    gate: ${names.gate},
    _cr: _cr, _reed: _reed, _qjii: _qjii, _iwruum: _iwruum,
  };`;
  return new Function(`${mocks}\n${prelude}\n${expose}`)();
}

const ORIG_NAMES = { xorDecode: '_cyval', hash: '_gqeod', isValid: '_oyxwu', gate: '_omcjj' };
const CLEAN_NAMES = {
  xorDecode: 'xorDecode', hash: 'cyrb53Hash',
  isValid: 'isValidLicenseKey', gate: 'getLicenseState',
};

const results = [];
function check(label, pass, detail) {
  results.push({ label, pass, detail });
}

function main() {
  const origPrelude = originalPrelude(fs.readFileSync('Code.gs', 'utf8'));
  const cleanCode = fs.readFileSync(process.argv[2] || 'Code.clean.gs', 'utf8');
  const cleanPrelude = cleanCode.slice(0, cleanCode.indexOf(BOUNDARY));

  const build = (which, storedKey, email) =>
    which === 'orig'
      ? sandbox(origPrelude, ORIG_NAMES, storedKey, email)
      : sandbox(cleanPrelude, CLEAN_NAMES, storedKey, email);

  // --- 3 lớp anti-tamper, kiểm trên bản dịch ---
  const c = build('clean', null, EMAILS[0]);
  check('anti-tamper #1  isValidLicenseKey.toString().length >= 40',
    c.isValid.toString().length >= 40, `= ${c.isValid.toString().length}`);
  check('anti-tamper #2  _iwruum === "7vv119ir"',
    c._iwruum === '7vv119ir', JSON.stringify(c._iwruum));
  check('anti-tamper #3  xorDecode(_qjii) === _cr',
    c.xorDecode(c._qjii) === c._cr, JSON.stringify(c.xorDecode(c._qjii)));

  // --- hằng số phải khớp bản gốc ---
  const o = build('orig', null, EMAILS[0]);
  check('_cr khớp bản gốc', o._cr === c._cr, JSON.stringify(c._cr));
  check('xorDecode(_reed) khớp bản gốc',
    o.xorDecode(o._reed) === c.xorDecode(c._reed), JSON.stringify(c.xorDecode(c._reed)));

  // --- hash: key đang dùng phải vẫn hợp lệ ---
  for (const email of EMAILS) {
    const salt = c.xorDecode(c._reed);
    const a = o.hash(email + salt);
    const b = c.hash(email + salt);
    check(`hash("${email}") khớp bản gốc`, a === b, `${a} vs ${b}`);
  }

  // --- cổng license: 3 nhánh trả về ---
  for (const email of EMAILS.slice(0, 2)) {
    const salt = c.xorDecode(c._reed);
    const goodKey = c.hash(email + salt);
    const cases = [
      ['chưa có key -> null', null, (v) => v === null],
      ['key sai -> false', 'sai-be-bet', (v) => v === false],
      ['key đúng -> chính key', goodKey, (v) => v === goodKey],
    ];
    for (const [name, key, ok] of cases) {
      const ov = build('orig', key, email).gate();
      const cv = build('clean', key, email).gate();
      check(`gate ${name} (${email})`,
        ok(ov) && ok(cv) && ov === cv, `orig=${JSON.stringify(ov)} clean=${JSON.stringify(cv)}`);
    }
  }

  let failed = 0;
  for (const r of results) {
    if (!r.pass) failed++;
    console.log(`  ${r.pass ? 'OK  ' : 'FAIL'}  ${r.label}  ${r.detail}`);
  }
  console.log(failed === 0 ? `  => PASS (${results.length} kiểm tra)` : `  => FAIL (${failed}/${results.length})`);
  process.exit(failed === 0 ? 0 : 1);
}

main();
