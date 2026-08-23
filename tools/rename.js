#!/usr/bin/env node
/**
 * Đặt tên có nghĩa cho các định danh `_0xNNNN` còn lại sau khi deobfuscate.
 *
 * Dùng: node tools/rename.js <input> <output> [--map <file.json>] [--report]
 *
 * Cách làm: dùng scope binding của Babel, nên mỗi tên chỉ đổi trong đúng scope
 * khai báo nó — hai function dùng trùng `_0x1234` vẫn được đặt tên độc lập.
 * Tên mới được suy ra từ biểu thức khởi tạo, từ vị trí tham số, hoặc từ cách
 * biến được dùng. Không suy được thì giữ nguyên `_0x...` (thà để nguyên còn
 * hơn đặt tên sai).
 *
 * `--map` nhận file JSON đè tên thủ công:
 *   { "<tênFunction>": { "_0xabc123": "tênMới" }, "*": { ... } }
 */
'use strict';

const fs = require('fs');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const t = require('@babel/types');
const { splitWrapper } = require('./deobfuscate');

const IS_OBF = /^_0x[0-9a-fA-F]+$/;

const RESERVED = new Set(
  ('break case catch class const continue debugger default delete do else export extends ' +
    'finally for function if import in instanceof new return super switch this throw try ' +
    'typeof var void while with yield let static enum await implements package protected ' +
    'interface private public null true false undefined NaN Infinity arguments eval')
    .split(' ')
);

/** "TASK_SHEET_NAME" -> "taskSheetName"; "proposal-submit-btn" -> "proposalSubmitBtn" */
function camel(raw) {
  const parts = String(raw)
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return '';
  return parts
    .map((p, i) => (i === 0 ? p.toLowerCase() : p[0].toUpperCase() + p.slice(1).toLowerCase()))
    .join('');
}

function cap(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

/** "projects" -> "project", "entries" -> "entry", "staff" -> "staff" */
function singular(name) {
  if (!name) return '';
  // Strip "all" prefix before processing (allProjects -> project, filteredAllTasks -> filteredTask)
  const base = collectionBase(name);
  if (!base) return '';
  if (/(ss|us|is|staff|data|info)$/i.test(base)) return base;
  if (/ies$/.test(base)) return base.slice(0, -3) + 'y';
  if (/(ch|sh|x|s)es$/.test(base)) return base.slice(0, -2);
  if (/s$/.test(base)) return base.slice(0, -1);
  return base;
}

/**
 * Bỏ chữ `all` khỏi tên mảng: `allProjects` -> `projects`,
 * `filteredAllTasks` -> `filteredTasks`. Nhờ vậy phần tử của `allProjects`
 * được gọi là `project` chứ không phải `allProject`.
 */
function collectionBase(name) {
  const s = String(name);
  const lead = s.match(/^all([A-Z].*)$/);
  if (lead) return camel(lead[1]);
  const mid = s.match(/^([a-z][A-Za-z0-9]*?)All([A-Z].*)$/);
  if (mid) return mid[1] + mid[2];
  return s;
}


/** `tasks.length` -> `taskCount`; `text.length` -> `textLength`. */
function countName(objName) {
  if (!objName) return 'count';
  const base = collectionBase(objName);
  if (/s$/.test(base) && !/(ss|us|is)$/i.test(base)) return singular(base) + 'Count';
  return camel(base) + 'Length';
}

/** Hàm của project + API Apps Script: tên hàm -> tên biến cho giá trị trả về. */
const CALL_RESULT = {
  getLicenseState: 'licenseKey',
  isValidLicenseKey: 'isValid',
  xorDecode: 'decoded',
  cyrb53Hash: 'hash',
  getCurrentUser: 'currentUser',
  getActiveSpreadsheet: 'spreadsheet',
  getActiveSheet: 'sheet',
  getSheetByName: 'sheet',
  insertSheet: 'sheet',
  getOrCreateSheet: 'sheet',
  getDataRange: 'dataRange',
  getRange: 'range',
  getValues: 'values',
  getDisplayValues: 'displayValues',
  getValue: 'value',
  getDisplayValue: 'displayValue',
  getLastRow: 'lastRow',
  getLastColumn: 'lastColumn',
  getHeaders: 'headers',
  getLastId: 'lastId',
  generateNextId: 'newId',
  findRowById: 'foundRow',
  parseSheetData: 'rows',
  sheetDataToObjectArray: 'rows',
  checkUserPermission: 'permission',
  getProjects: 'projects',
  getTasks: 'tasks',
  getStaff: 'staffList',
  getApps: 'apps',
  getProposals: 'proposals',
  getScriptLock: 'lock',
  getScriptProperties: 'scriptProperties',
  getUserProperties: 'userProperties',
  getProperty: 'storedValue',
  getEffectiveUser: 'effectiveUser',
  getActiveUser: 'activeUser',
  getEmail: 'email',
  getProjectTriggers: 'triggers',
  getScriptTimeZone: 'timeZone',
  formatDate: 'formattedDate',
  getUi: 'ui',
  getId: 'id',
  getName: 'name',
  getUrl: 'url',
  getContent: 'content',
  getBlob: 'blob',
  createHtmlOutputFromFile: 'htmlOutput',
  createTemplateFromFile: 'template',
  evaluate: 'htmlOutput',
  parseDate: 'parsedDate',
  formatJSONCompact: 'json',
  getElementById: 'el',
  querySelector: 'el',
  querySelectorAll: 'els',
  getElementsByClassName: 'els',
  getElementsByTagName: 'els',
  createElement: 'el',
  parse: 'parsed',
  stringify: 'json',
  keys: 'keys',
  entries: 'entries',
  from: 'list',
  now: 'timestamp',
  match: 'match',
  split: 'parts',
  join: 'joined',
  trim: 'trimmed',
  toLowerCase: 'lower',
  toUpperCase: 'upper',
  toISOString: 'isoString',
  toFixed: 'formatted',
  padStart: 'padded',
  concat: 'combined',
  flat: 'flattened',
  sort: 'sorted',
  reverse: 'reversed',
  slice: 'slice',
  splice: 'removed',
  indexOf: 'index',
  findIndex: 'index',
  includes: 'hasMatch',
  some: 'hasMatch',
  every: 'allMatch',
  reduce: 'total',
  appendRow: 'appended',
  flush: 'flushed',
  parseInt: 'num',
  parseFloat: 'num',
  Number: 'num',
  String: 'text',
  Boolean: 'flag',
  isNaN: 'invalid',
  fill: 'row',
  charCodeAt: 'charCode',
  charAt: 'char',
  substring: 'text',
  substr: 'text',
  replace: 'text',
  repeat: 'text',
  setProperty: 'scriptProperties',
  hasOwnProperty: 'hasKey',
  toString: 'text',
  valueOf: 'value',
  abs: 'num',
  round: 'num',
  floor: 'num',
  ceil: 'num',
  max: 'num',
  min: 'num',
};

/** Tên hàm đang được gọi (identifier hoặc `.method`). */
function calleeName(node) {
  if (t.isIdentifier(node)) return node.name;
  if ((t.isMemberExpression(node) || t.isOptionalMemberExpression(node)) &&
      t.isIdentifier(node.property) && !node.computed) {
    return node.property.name;
  }
  return null;
}

/** Tên object mà method được gọi lên, nếu là identifier đã có tên tử tế. */
function objectName(node) {
  if (!t.isMemberExpression(node) && !t.isOptionalMemberExpression(node)) return null;
  const obj = node.object;
  if (t.isIdentifier(obj) && !IS_OBF.test(obj.name)) return obj.name;
  return null;
}

/** Hằng số cột/sheet -> gốc tên: "TASK_DUE_DATE_COLUMN_NAME" -> "taskDueDate" */
function fromConstName(name) {
  const base = String(name)
    .replace(/_COLUMN_NAME$/, '')
    .replace(/_COLUMN$/, '')
    .replace(/_SHEET_NAME$/, '')
    .replace(/_NAME$/, '');
  return camel(base);
}

/** COL.T_DUE -> "taskDue"  (map tiền tố của bảng COL ở frontend) */
const COL_PREFIX = {
  P: 'project', T: 'task', S: 'staff', N: 'notification', PR: 'proposal', A: 'app',
};
function fromColKey(key) {
  const m = String(key).match(/^([A-Z]+)_(.+)$/);
  if (!m || !COL_PREFIX[m[1]]) return camel(key);
  return COL_PREFIX[m[1]] + cap(camel(m[2]));
}

/** Đối số đầu tiên nếu nó là hằng số / chuỗi -> dùng để đặt tên. */
function argHint(arg) {
  if (!arg) return null;
  if (t.isStringLiteral(arg)) return camel(arg.value);
  if (t.isIdentifier(arg) && /^[A-Z][A-Z0-9_]*$/.test(arg.name)) return fromConstName(arg.name);
  if (t.isMemberExpression(arg) && t.isIdentifier(arg.object) && arg.object.name === 'COL' &&
      t.isIdentifier(arg.property)) {
    return fromColKey(arg.property.name);
  }
  return null;
}

/** Suy tên từ biểu thức khởi tạo. Trả null nếu không đủ tự tin. */
function nameFromInit(node) {
  if (!node) return null;

  if (t.isNewExpression(node)) {
    const ctor = calleeName(node.callee);
    if (ctor === 'Date') return node.arguments.length ? 'date' : 'now';
    if (ctor === 'FormData') return 'formData';
    if (ctor === 'RegExp') return 'pattern';
    if (ctor === 'Error') return 'err';
    if (ctor === 'Map') return 'map';
    if (ctor === 'Set') return 'set';
    return ctor ? camel(ctor) : null;
  }

  if (t.isCallExpression(node) || t.isOptionalCallExpression(node)) {
    const fn = calleeName(node.callee);
    if (!fn) return null;
    const obj = objectName(node.callee);
    const hint = argHint(node.arguments[0]);

    if (fn === 'getSheetByName' || fn === 'insertSheet' || fn === 'getOrCreateSheet') {
      const h = argHint(node.arguments[fn === 'getOrCreateSheet' ? 1 : 0]);
      return h ? camel(h.replace(/Sheet$/, '')) + 'Sheet' : 'sheet';
    }
    if (fn === 'indexOf' && hint) return hint + 'Index';
    if (fn === 'findIndex') return obj ? singular(obj) + 'Index' : 'index';
    if (fn === 'getElementById' && hint) return hint + 'El';
    if (fn === 'getProperty' && hint) return 'stored' + cap(hint);
    if (fn === 'find') return obj ? singular(obj) : 'found';
    if (fn === 'filter') return obj ? 'filtered' + cap(collectionBase(obj)) : 'filtered';
    if (fn === 'map') return obj ? 'mapped' + cap(collectionBase(obj)) : 'mapped';
    if (fn === 'reduce') return obj ? singular(obj) + 'Total' : 'total';

    if (CALL_RESULT[fn]) return CALL_RESULT[fn];
    const generic = fn.match(/^(?:get|load|fetch|read|build|make|create|compute|calc)([A-Z].*)$/);
    if (generic) return camel(generic[1]);
    if (/^is[A-Z]|^has[A-Z]|^can[A-Z]|^should[A-Z]/.test(fn)) return camel(fn);
    return null;
  }
  return nameFromValue(node);
}

/** Nhánh không phải call/new: member, literal, toán tử. */
function nameFromValue(node) {
  if (t.isMemberExpression(node) || t.isOptionalMemberExpression(node)) {
    if (t.isIdentifier(node.property) && !node.computed) {
      const prop = node.property.name;
      if (t.isIdentifier(node.object) && node.object.name === 'COL') return fromColKey(prop);
      // `.length` không bao giờ dùng làm tên biến — dễ trùng, khó đọc.
      if (prop === 'length') return countName(objectName(node));
      if (/^(value|name|id|success|error|message)$/.test(prop)) {
        const obj = objectName(node);
        return obj ? camel(obj) + cap(prop) : prop;
      }
      return camel(prop);
    }
    if (node.computed) {
      const hint = argHint(node.property);
      if (hint) return hint;
      // `row[projectTasksJsonIndex]` -> "projectTasksJson"
      if (t.isIdentifier(node.property) && /Index$/.test(node.property.name)) {
        return node.property.name.replace(/Index$/, '');
      }
      const obj = objectName(node);
      if (obj) return singular(obj);
      // `values[i][0]` -> lấy identifier gốc ngoài cùng
      let base = node.object;
      while (t.isMemberExpression(base)) base = base.object;
      if (t.isIdentifier(base) && !IS_OBF.test(base.name)) return singular(base.name);
      return null;
    }
    return null;
  }
  if (t.isArrayExpression(node)) return node.elements.length ? 'values' : 'list';
  if (t.isObjectExpression(node)) {
    const keys = node.properties
      .filter((p) => t.isObjectProperty(p) && t.isIdentifier(p.key))
      .map((p) => p.key.name);
    if (keys.includes('success')) return 'result';
    return 'data';
  }
  if (t.isStringLiteral(node) || t.isTemplateLiteral(node)) return 'text';
  if (t.isNumericLiteral(node)) return 'num';
  if (t.isBooleanLiteral(node)) return 'flag';
  if (t.isArrowFunctionExpression(node) || t.isFunctionExpression(node)) return 'callback';
  if (t.isConditionalExpression(node)) {
    return nameFromInit(node.consequent) || nameFromInit(node.alternate);
  }
  if (t.isLogicalExpression(node)) {
    return nameFromInit(node.left) || nameFromInit(node.right);
  }
  if (t.isBinaryExpression(node)) {
    if (node.operator === '+') return 'text';
    if (['-', '*', '/', '%'].includes(node.operator)) return 'num';
    return 'flag';
  }
  if (t.isUnaryExpression(node) && node.operator === '!') return 'flag';
  if (t.isAwaitExpression(node)) return nameFromInit(node.argument);
  if (t.isIdentifier(node) && !IS_OBF.test(node.name)) return camel(node.name);
  return null;
}

/** Tham số của callback theo vị trí, dựa vào method đang nhận callback. */
const CALLBACK_PARAMS = {
  forEach: ['item', 'index', 'array'],
  map: ['item', 'index', 'array'],
  filter: ['item', 'index', 'array'],
  find: ['item', 'index', 'array'],
  findIndex: ['item', 'index', 'array'],
  some: ['item', 'index', 'array'],
  every: ['item', 'index', 'array'],
  flatMap: ['item', 'index', 'array'],
  reduce: ['acc', 'item', 'index'],
  sort: ['a', 'b'],
  addEventListener: ['event'],
  withSuccessHandler: ['response'],
  withFailureHandler: ['error'],
  then: ['result'],
  catch: ['err'],
  setTimeout: [],
  setInterval: [],
};

/** Suy tên cho tham số. Trả null nếu không đủ tự tin. */
function nameFromParam(path, index) {
  const fnPath = path.parentPath;
  if (!fnPath) return null;

  if (t.isCatchClause(fnPath.node)) return 'err';

  const holder = fnPath.parentPath;
  if (holder && (t.isCallExpression(holder.node) || t.isOptionalCallExpression(holder.node))) {
    const method = calleeName(holder.node.callee);
    const table = CALLBACK_PARAMS[method];
    if (table) {
      const base = table[index];
      if (!base) return null;
      if (base === 'item') {
        const obj = objectName(holder.node.callee);
        return obj ? singular(obj) : 'item';
      }
      return base;
    }
  }
  return null;
}

/** Các thuộc tính/hằng số được đọc trên một biến -> đoán biến đó là gì. */
const USAGE_RULES = [
  [['getRange', 'appendRow', 'getLastRow', 'setFrozenRows', 'getDataRange'], 'sheet'],
  [['classList', 'addEventListener', 'innerHTML', 'textContent', 'disabled', 'checked', 'closest'], 'el'],
  [['rowNumber', 'rowIndex'], 'foundRow'],
  [['stack'], 'err'],
  [['success'], 'result'],
  [['waitLock', 'releaseLock'], 'lock'],
  [['getSheetByName', 'insertSheet', 'getSheets'], 'spreadsheet'],
];

const CONST_OWNER = [
  [/^TASK_/, 'task'], [/^PROJECT_/, 'project'], [/^STAFF_/, 'staff'],
  [/^PROPOSAL_/, 'proposal'], [/^APP_/, 'app'], [/^NOTIFICATION_/, 'notification'],
  [/^LOG_/, 'logEntry'], [/^CHAT_/, 'chat'],
];
const COL_OWNER = { P: 'project', T: 'task', S: 'staff', N: 'notification', PR: 'proposal', A: 'app' };

/** Suy tên từ cách biến được dùng (khi khởi tạo không nói gì). */
function nameFromUsage(binding) {
  const props = new Set();
  const owners = new Set();

  for (const ref of binding.referencePaths) {
    const parent = ref.parentPath;
    if (!parent) continue;
    const node = parent.node;
    if (!t.isMemberExpression(node) && !t.isOptionalMemberExpression(node)) continue;
    if (node.object !== ref.node) continue;

    if (!node.computed && t.isIdentifier(node.property)) {
      props.add(node.property.name);
      continue;
    }
    if (t.isIdentifier(node.property) && /^[A-Z][A-Z0-9_]*$/.test(node.property.name)) {
      for (const [re, owner] of CONST_OWNER) if (re.test(node.property.name)) owners.add(owner);
      continue;
    }
    if (t.isMemberExpression(node.property) && t.isIdentifier(node.property.object) &&
        node.property.object.name === 'COL' && t.isIdentifier(node.property.property)) {
      const m = node.property.property.name.match(/^([A-Z]+)_/);
      if (m && COL_OWNER[m[1]]) owners.add(COL_OWNER[m[1]]);
    }
  }

  if (owners.size === 1) return [...owners][0];
  for (const [names, guess] of USAGE_RULES) {
    if (names.some((n) => props.has(n))) return guess;
  }
  if (props.has('name') && (props.has('email') || props.has('role'))) return 'user';
  if (props.has('message')) return 'err';
  if (owners.size > 1) return 'row';
  return null;
}

/** Mọi scope trong cây, kèm độ sâu. */
function collectScopes(ast) {
  const seen = new Set();
  traverse(ast, {
    enter(path) {
      seen.add(path.scope);
    },
  });
  return [...seen].map((scope) => {
    let depth = 0;
    for (let s = scope.parent; s; s = s.parent) depth++;
    return { scope, depth };
  }).sort((a, b) => a.depth - b.depth);
}

/** Tên function bao quanh scope — dùng để tra bảng đè tên thủ công. */
function enclosingFunctionName(scope) {
  for (let s = scope; s; s = s.parent) {
    const node = s.path && s.path.node;
    if (t.isFunctionDeclaration(node) && node.id) return node.id.name;
    if ((t.isFunctionExpression(node) || t.isArrowFunctionExpression(node)) &&
        t.isVariableDeclarator(s.path.parent) && t.isIdentifier(s.path.parent.id)) {
      return s.path.parent.id.name;
    }
  }
  return '*';
}

/**
 * Tên bị chiếm ở phạm vi toàn file: identifier tự do (SpreadsheetApp, COL, ...)
 * và binding ở scope chương trình (hằng số, tên function). Biến local của các
 * function khác KHÔNG tính — trùng tên giữa hai function là vô hại, và nhờ vậy
 * mỗi function đều được dùng những tên đẹp như `sheet`, `headers`.
 */
function programNames(ast, scopes) {
  const taken = new Set(RESERVED);
  const root = scopes[0].scope.getProgramParent();
  Object.keys(root.globals || {}).forEach((n) => taken.add(n));
  for (const name of Object.keys(root.bindings)) {
    if (!IS_OBF.test(name)) taken.add(name);
  }
  return taken;
}

/** Vị trí của tham số trong danh sách params. */
function paramIndex(path) {
  const fn = path.parentPath && path.parentPath.node;
  if (!fn || !fn.params) return -1;
  return fn.params.indexOf(path.node);
}

/** Tên đề xuất cho một binding, chưa xét trùng. null = không đủ tự tin. */
function inferName(binding) {
  const path = binding.path;
  if (t.isCatchClause(path.node) || t.isCatchClause(path.parent)) return 'err';
  if (binding.kind === 'param') {
    const idx = paramIndex(path);
    return nameFromParam(path, idx < 0 ? 0 : idx) || nameFromUsage(binding);
  }
  if (t.isVariableDeclarator(path.node)) {
    // Biến đếm của for -> i
    const decl = path.parentPath;
    if (decl && decl.parentPath && t.isForStatement(decl.parentPath.node) &&
        decl.parentPath.node.init === decl.node) {
      return 'i';
    }
    const fromInit = nameFromInit(path.node.init);
    if (fromInit) return fromInit;
    // `let x;` hoặc `= null` -> nhìn phép gán đầu tiên
    for (const v of binding.constantViolations || []) {
      if (t.isAssignmentExpression(v.node) && v.node.operator === '=') {
        const guess = nameFromInit(v.node.right);
        if (guess) return guess;
      }
    }
    return nameFromUsage(binding);
  }
  if (t.isFunctionDeclaration(path.node)) return null;
  return nameFromUsage(binding);
}

/** Đổi tên toàn bộ binding `_0x...`; trả về thống kê. */
function renameAll(ast, overrides) {
  const scopes = collectScopes(ast);
  const taken = programNames(ast, scopes);
  const stats = { renamed: 0, kept: 0, byName: new Map(), keptNames: [] };

  for (const { scope } of scopes) {
    const fnName = enclosingFunctionName(scope);
    const local = new Set();
    for (const oldName of Object.keys(scope.bindings)) {
      if (!IS_OBF.test(oldName)) continue;
      const binding = scope.bindings[oldName];
      if (!binding) continue;

      const manual =
        (overrides[fnName] && overrides[fnName][oldName]) ||
        (overrides['*'] && overrides['*'][oldName]) ||
        null;
      let base = manual || inferName(binding);
      if (!base || !/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(base)) {
        stats.kept++;
        let where = '';
        try {
          const node = binding.kind === 'param' ? binding.path.parentPath.node : binding.path.node;
          where = generate(t.isFunction(node)
            ? t.functionDeclaration(node.id || t.identifier(fnName), node.params, t.blockStatement([]))
            : node, { compact: true }).code.replace(/\s+/g, ' ').slice(0, 110);
        } catch (_) {
          where = '?';
        }
        stats.keptNames.push(`${fnName}:${oldName}  ${where}`);
        continue;
      }
      if (RESERVED.has(base)) base = '_' + base;

      let candidate = base;
      let n = 2;
      while (taken.has(candidate) || local.has(candidate) || scope.hasBinding(candidate)) {
        candidate = base + n++;
      }
      local.add(candidate);
      scope.rename(oldName, candidate);
      stats.renamed++;
      stats.byName.set(base, (stats.byName.get(base) || 0) + 1);
    }
  }
  return stats;
}

/** Tập identifier tự do (chưa khai báo) — phải y nguyên trước/sau khi đổi tên. */
function freeIdentifiers(code) {
  const ast = parser.parse(code, { sourceType: 'script' });
  let names = [];
  traverse(ast, {
    Program(path) {
      names = Object.keys(path.scope.globals).sort();
      path.stop();
    },
  });
  return names;
}

function main() {
  const argv = process.argv.slice(2);
  const input = argv[0];
  const output = argv[1];
  if (!input || !output) {
    console.error('Dùng: node tools/rename.js <input> <output> [--map <file.json>] [--report]');
    process.exit(1);
  }
  const mapIdx = argv.indexOf('--map');
  const overrides = mapIdx !== -1 && argv[mapIdx + 1]
    ? JSON.parse(fs.readFileSync(argv[mapIdx + 1], 'utf8'))
    : {};

  const raw = fs.readFileSync(input, 'utf8');
  const { prefix, code, suffix } = splitWrapper(raw);
  const before = freeIdentifiers(code);

  const ast = parser.parse(code, { sourceType: 'script', errorRecovery: false });
  const stats = renameAll(ast, overrides);
  const out = generate(ast, {
    compact: false,
    retainLines: false,
    comments: true,
    jsescOption: { minimal: true },
  }).code;

  // Nếu một phép đổi tên vô tình "bắt" mất một tham chiếu toàn cục thì tập
  // identifier tự do sẽ khác đi — chặn ngay, không ghi file.
  const after = freeIdentifiers(out);
  const missing = before.filter((n) => !after.includes(n));
  const extra = after.filter((n) => !before.includes(n));
  if (missing.length || extra.length) {
    console.error('LỖI: tập identifier tự do thay đổi sau khi đổi tên.');
    if (missing.length) console.error('  mất : ' + missing.join(', '));
    if (extra.length) console.error('  thêm: ' + extra.join(', '));
    process.exit(1);
  }

  fs.writeFileSync(output, prefix ? `${prefix}\n${out}\n${suffix}` : `${out}\n`, 'utf8');

  const left = (out.match(/_0x[0-9a-f]+/g) || []).length;
  console.log(`${input} -> ${output}`);
  console.log(`  đã đặt tên : ${stats.renamed}`);
  console.log(`  giữ nguyên : ${stats.kept}`);
  console.log(`  _0x còn lại: ${left}`);
  if (argv.includes('--report')) {
    const top = [...stats.byName.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25);
    console.log('  tên dùng nhiều nhất: ' + top.map(([n, c]) => `${n}(${c})`).join(', '));
    if (stats.keptNames.length) {
      console.log('  chưa suy được:\n    ' + stats.keptNames.join('\n    '));
    }
  }
}

if (require.main === module) main();

module.exports = { camel, singular, collectionBase, countName, nameFromInit, renameAll };









