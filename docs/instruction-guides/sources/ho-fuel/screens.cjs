/* Render the actual HO Fuel components with empty data for privacy-safe guide captures. */
const fs=require('node:fs'), path=require('node:path'), ts=require('typescript');
const React=require('react'), {renderToStaticMarkup}=require('react-dom/server');
const root=__dirname;
const component=fs.readFileSync('src/app/(dashboard)/ho-fuel/page.tsx','utf8');
const css=fs.readFileSync('src/app/(dashboard)/ho-fuel/ho-fuel.module.css','utf8');
const classes=Object.fromEntries([...css.matchAll(/\.([A-Za-z_][\w-]*)/g)].map(m=>[m[1],m[1]]));
function load(source, deps){const m={exports:{}};new Function('require','module','exports',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText)(n=>n in deps?deps[n]:require(n),m,m.exports);return m.exports;}
const fuel=load(fs.readFileSync('src/lib/ho-fuel.ts','utf8'),{});
for(const tab of ['overview','entry','log','consumers']){
 let index=0;
 const mockReact={...React,useState:initial=>{const i=index++;return [i===0?tab:i===1?[]:i===2?false:typeof initial==='function'?initial():initial,()=>{}];}};
 const picker=load(fs.readFileSync('src/components/ui/file-upload-button.tsx','utf8'),{react:mockReact});
 const bills=load(fs.readFileSync('src/app/(dashboard)/ho-fuel/bills.tsx','utf8'),{react:mockReact,'@/components/ui/file-upload-button':picker});
 const Page=load(component,{'react':mockReact,'next/link':({children,...p})=>React.createElement('a',p,children),'@/lib/supabase':{},'@/lib/ho-fuel':fuel,'./bills':bills,'./ho-fuel.module.css':{default:classes,__esModule:true}}).default;
 const html=renderToStaticMarkup(React.createElement(Page));
 fs.writeFileSync(path.join(root,tab+'.html'),`<!doctype html><html><meta charset="utf-8"><style>:root{--t-bg:#faf6ec;--t-surface:#f5efdf;--t-card:#fffdf8;--t-border:#d9dece;--t-text:#212621;--t-muted:#596357;--t-accent:#4a9e4a;--t-green:#2d6e2d;--t-gold:#947343}*{box-sizing:border-box}body{margin:0;padding:18px;background:var(--t-bg);font-family:Arial;font-size:14px}${css}${fs.readFileSync('src/app/globals.css','utf8').split('/* Approved MSP Coffee actions:')[1].replace(/^[\s\S]*?\*\//,'')}.cpPanel,.cpOverlay{display:none!important}.chartsFullRow,.charts2col{display:none}</style><body>${html}</body></html>`);
}
