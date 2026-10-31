const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function load(){
  const elements=new Map();
  const document={getElementById(id){if(!elements.has(id))elements.set(id,{value:['filter','status'].includes(id)?'all':'',innerHTML:'',querySelectorAll(){return []}});return elements.get(id)}};
  const events={};
  const ctx=vm.createContext({document,localStorage:{getItem(){return null}},window:{addEventListener(name,fn){events[name]=fn},print(){}},Date});
  vm.runInContext(fs.readFileSync('index.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1],ctx);
  return {ctx,document,events};
}

test('photo printing includes all 28 local images despite screen filters and preserves live inventory',()=>{
  const {ctx,document}=load();
  document.getElementById('filter').value='Dairy';
  document.getElementById('search').value='milk';
  vm.runInContext("products.find(p=>p.id===36).qty=5; products.find(p=>p.id===36).expiry='2027-02-01';buildPrintSheet(true)",ctx);
  const output=document.getElementById('printSheet').innerHTML;
  assert.equal((output.match(/<img /g)||[]).length,28);
  assert(output.includes('assets/products/36.jpg'));
  assert(output.includes('Great Value Penne Pasta'));
  assert(output.includes('<td>5</td><td>0</td><td>2027-02-01'));
  assert(output.includes('Ingredient label check required'));
});

test('compact print stays photo-free through beforeprint, then can switch back to photos',()=>{
  const {ctx,document,events}=load();
  vm.runInContext('buildPrintSheet(false)',ctx);events.beforeprint();
  assert.equal((document.getElementById('printSheet').innerHTML.match(/<img /g)||[]).length,0);
  vm.runInContext('buildPrintSheet(true)',ctx);events.beforeprint();
  assert.equal((document.getElementById('printSheet').innerHTML.match(/<img /g)||[]).length,28);
});

test('print dialog waits for photo decoding, including a failed image',async()=>{
  const {ctx,document}=load();
  let finish;const pending=new Promise(resolve=>{finish=resolve});
  document.getElementById('printSheet').querySelectorAll=()=>[{decode:()=>pending},{decode:()=>Promise.reject(new Error('missing photo'))}];
  let printed=false;ctx.window.print=()=>{printed=true};
  const result=vm.runInContext('printInventory(true)',ctx);
  assert.equal(printed,false);
  finish();await result;
  assert.equal(printed,true);
});

test('in-store badges appear on screen and print without treating photographed stock as a quantity count',()=>{
  const {ctx,document}=load();
  const data=vm.runInContext('products',ctx);
  assert.equal(data.filter(p=>p.inStore).length,11);
  assert.equal((document.getElementById('sections').innerHTML.match(/>✓ In Store<\/span>/g)||[]).length,11);
  assert.equal(data.find(p=>p.name==='Armour Original Vienna Sausage').qty,0);
  vm.runInContext('buildPrintSheet(true)',ctx);
  assert.equal((document.getElementById('printSheet').innerHTML.match(/>✓ In Store<\/span>/g)||[]).length,11);
  for(const cat of ['Dairy','Grains','Protein','Produce'])assert.equal(new Set(data.filter(p=>p.cat===cat).map(p=>p.variety)).size,7);
});
