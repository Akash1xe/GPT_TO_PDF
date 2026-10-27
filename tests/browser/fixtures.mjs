export const rasterPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4//8/AwAI/AL+7zKGAAAAAElFTkSuQmCC";
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="360" height="140" viewBox="0 0 360 140"><rect x="3" y="3" width="350" height="130" fill="#f4f8ff" stroke="#0a696b"/><path d="M30 65 L150 65 L150 110" stroke="#0a696b" fill="none"/><text x="35" y="45" font-size="20">Diagram: Pipeline</text></svg>';
export const diagramSvg = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);

const txt = (text) => ({type:"text",text});
const para = (text) => ({type:"paragraph",children:[txt(text)]});
export function richFixture() {
 const messages=[
  {id:"e2e-user",role:"user",order:0,plainText:"Explain the sample",blocks:[para("Explain the sample")]},
  {id:"e2e-assistant",role:"assistant",order:1,plainText:"CHUNK9_PDF_RICH_FIDELITY",blocks:[
   {type:"heading",level:2,children:[txt("CHUNK9_PDF_RICH_FIDELITY")]},
   {type:"paragraph",children:[
    txt("Read "),{type:"link",href:"https://example.com/guide",children:[txt("the guide")]},
    txt(" for this "),{type:"math",displayMode:"inline",source:"\\frac{1}{2}",sourceFormat:"latex",fallbackText:"one half",renderStrategy:"latex"}
   ]},
   {type:"code",language:"javascript",displayLanguage:"JavaScript",code:"const value = 42;\nreturn value;",source:"dom-highlighted",lineCount:2,maxLineLength:17,hasLongLines:false,tabSize:2,lines:[
    {number:1,plainText:"const value = 42;",tokens:[{text:"const",tokenType:"keyword"},{text:" value = ",tokenType:"plain"},{text:"42",tokenType:"number"},{text:";",tokenType:"punctuation"}]},
    {number:2,plainText:"return value;",tokens:[{text:"return",tokenType:"keyword"},{text:" value;",tokenType:"plain"}]},
   ]},
   {type:"table",columnCount:2,rows:[
    {cells:[{header:true,colspan:2,rowspan:1,children:[txt("TABLE_CHUNK9_RESULTS")]}]},
    {cells:[{header:false,colspan:1,rowspan:1,children:[txt("alpha")]},{header:false,colspan:1,rowspan:1,children:[txt("beta")]}]},
   ]},
   {type:"image",mediaKind:"svg",sourceType:"data",src:diagramSvg,alt:"Pipeline diagram",width:360,height:140,caption:"SVG_DIAGRAM_CHUNK9"},
   {type:"image",mediaKind:"image",sourceType:"data",src:rasterPng,alt:"Raster test pixel",width:90,height:75},
   {type:"math",displayMode:"block",source:"\\begin{bmatrix}1&2\\\\3&4\\end{bmatrix}",sourceFormat:"latex",fallbackText:"Matrix",renderStrategy:"latex"},
   {type:"layout",columns:2,card:true,sourceBackground:"#f2faf4",sourceBorder:"#21764b",columnWidths:"1fr 1fr",blocks:[
    {type:"layout",columns:1,card:false,blocks:[para("GRID_LEFT_CHUNK9")]},
    {type:"layout",columns:1,card:false,blocks:[para("GRID_RIGHT_CHUNK9")]}
   ]},
   {type:"control",kind:"checkbox",checked:true,percent:0,text:"[x] Checked item"}
  ]}
 ];
 return conversation(messages,"Chunk 9 PDF Real Browser");
}
export function longFixture(count=120) {
 const messages=Array.from({length:count},(_,i)=>{
  const role=i%2===0?"user":"assistant";
  const p=`LONG_CHAT_TURN_${String(i+1).padStart(3,"0")}`;
  const blocks=[
   {type:"heading",level:3,children:[txt(p)]},
   para(`Testing page flow ${i+1}. `+"Printed conversation lines must stay selectable and appear in reading order. ".repeat(8)),
  ];
  if(i%12===1) {
   blocks.push({type:"table",columnCount:2,rows:[
    {cells:[{header:true,colspan:1,rowspan:1,children:[txt("Result key")]},{header:true,colspan:1,rowspan:1,children:[txt("Result value")]}]},
    ...Array.from({length:4},(_,j)=>({cells:[{header:false,colspan:1,rowspan:1,children:[txt(`row-${i}-${j}`)]},{header:false,colspan:1,rowspan:1,children:[txt(`data-${j}`)]}]}))
   ]});
  }
  if(i%20===3) blocks.push({type:"code",language:"python",displayLanguage:"Python",code:"for x in range(3):\n    print(x)",source:"plain",lineCount:2,hasLongLines:false,maxLineLength:19,tabSize:4,lines:[{number:1,plainText:"for x in range(3):",tokens:[{text:"for x in range(3):",tokenType:"plain"}]},{number:2,plainText:"    print(x)",tokens:[{text:"    print(x)",tokenType:"plain"}]}]});
  return {id:`long-${i}`,role,order:i,plainText:p,blocks};
 });
 return conversation(messages,"Long conversation pagination fixture");
}
function conversation(messages,title) {
 const count=messages.length;
 return {
  provider:"chatgpt",title,url:"https://chatgpt.com/c/pdf-quality-fixture",capturedUrl:"https://chatgpt.com/c/pdf-quality-fixture",
  capturedAt:"2026-10-27T00:00:00.000Z",messageCount:count,possiblyPartial:true,
  completeness:{state:"possibly-partial",reason:"unknown",collectedMessages:count,verifiedBeginning:false,verifiedEnd:false,continuityVerified:false},
  messages,stats:{totalMessages:count,userMessages:messages.filter(m=>m.role==="user").length,assistantMessages:messages.filter(m=>m.role==="assistant").length,codeBlocks:0,mathNodes:0,images:0}
 };
}
export const preferences = (overrides={}) => ({
 pdfTheme:"light",pageSize:"A4",messageFilter:"all",excludeUserMessages:false,
 includeTitle:true,includeExportDate:true,includeSourceUrl:false,
 codeTheme:"light",wrapCode:true,showCodeLanguage:true,marginPreset:"normal",
 customMargins:{top:11,right:11,bottom:11,left:11},messagePadding:"normal",messageSpacing:"normal",
 paragraphSpacing:"normal",lineSpacing:"normal",bodyFontFamily:"arial",
 bodyFontSize:10,textWeight:"regular",customTextWeight:400,codeFontSize:9,
 ...overrides
});
