// The existing unit harnesses load TS modules with explicit dependency injection.
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const mod = { exports: {} };
const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../../src/lib/date-format.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
new Function('module', 'exports', code)(mod, mod.exports);
module.exports = name => {
  if (name === '@/lib/date-format') return mod.exports;
  // Form tests exercise their ISO-value handlers; the actual control is tested in date-format.test.cjs.
  if (name === '@/components/ui/date-input') return { DateInput: 'input' };
  if (name === '@/components/ui/date-time-input') return { DateTimeInput: 'input' };
  return null;
};
