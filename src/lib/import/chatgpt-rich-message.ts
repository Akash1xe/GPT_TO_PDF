import { parse } from "acorn";
import type { ContentBlock } from "@/lib/conversation/content";
import { safeLinkHref, safeSourceUrl } from "@/lib/conversation/urls";
import { children, descendants, parseHtmlTree, tag } from "@/lib/extractors/html-tree";
import { parseSemanticBlocks, semanticBlocksToPlainText } from "@/lib/extractors/semantic-html-parser";
import { parseRichMarkdown } from "./markdown";

type Obj = Record<string, unknown>;
type Ui = string | number | boolean | null | Element | Ui[];
interface Element { name: string; props: Obj; children: Ui[] }
const obj = (v: unknown): Obj => v !== null && typeof v === "object" && !Array.isArray(v) ? v as Obj : {};
const str = (v: unknown): string => typeof v === "string" ? v : "";
const escape = (v: unknown): string => String(v ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const colors: Record<string,string> = { secondary:"#737373", tertiary:"#888888", success:"#15803d", danger:"#b91c1c", warning:"#a16207", primary:"#171717", "surface-secondary":"#242424", "surface-tertiary":"#303030" };

/** Read a narrowly defined data-shaped render tree from ChatGPT metadata.
 * Acorn parses syntax only. No functions, callbacks, scripts, or constructors
 * from a conversation are executed. Unsupported expressions use Markdown.
 */
function staticTree(code: string, constants: Obj): Ui {
  if (code.length > 1_000_000) throw Error("UI metadata exceeds its size limit.");
  const ast = parse(code, { ecmaVersion: "latest" });
  let budget = 30_000;
  const env = new Map<string,Ui>();
  function member(node: unknown, owner: string, property: string) {
    const n=obj(node);
    return n.type === "MemberExpression" && obj(n.object).name === owner && obj(n.property).name === property && !n.computed;
  }
  function properties(node: unknown, depth: number): Obj {
    const n=obj(node), result:Obj=Object.create(null);
    if(n.type!=="ObjectExpression")return result;
    for(const entry of n.properties as unknown[]){
      const p=obj(entry), key=str(obj(p.key).name)||str(obj(p.key).value);
      if(p.type!=="Property"||p.computed||!key||key.startsWith("on")||["style","dangerouslySetInnerHTML","__proto__","constructor","prototype"].includes(key))continue;
      try { result[key]=read(p.value,depth+1); } catch { /* Dynamic properties have no static state. */ }
    }
    return result;
  }
  function read(value: unknown, depth=0): Ui {
    if(--budget<0||depth>100)throw Error("UI metadata is too complex.");
    const n=obj(value);
    if(n.type==="Literal" && ["string","number","boolean"].includes(typeof n.value)) return n.value as string|number|boolean;
    if(n.type==="Literal" && n.value===null)return null;
    if(n.type==="Identifier" && n.name==="undefined")return null;
    if(n.type==="Identifier" && env.has(str(n.name)))return env.get(str(n.name))!;
    if(n.type==="MemberExpression" && obj(n.object).name==="__dilConstants" && n.computed){
      const key=read(n.property,depth+1);
      const v=Object.hasOwn(constants,String(key))?constants[String(key)]:null;
      if(v===null||["string","number","boolean"].includes(typeof v))return v as Ui;
    }
    if(n.type==="ArrayExpression")return (n.elements as unknown[]).map(v=>read(v,depth+1));
    if(n.type==="ArrowFunctionExpression"||n.type==="FunctionExpression"){
      const body=obj(n.body);
      if(body.type!=="BlockStatement")return read(body,depth+1);
      for(const statement of body.body as unknown[]){
        const s=obj(statement);
        if(s.type==="VariableDeclaration")for(const declaration of s.declarations as unknown[]){
          const d=obj(declaration), id=obj(d.id), init=obj(d.init);
          try {
            if(id.type==="Identifier")env.set(str(id.name),read(init,depth+1));
            else if(id.type==="ArrayPattern"&&member(init.callee,"DIL","useState")){
              const first=obj((id.elements as unknown[])[0]);
              env.set(str(first.name),read((init.arguments as unknown[])[0],depth+1));
            }
          }catch{/* Ignore application logic and hooks. */}
        }
        if(s.type==="ReturnStatement")return read(s.argument,depth+1);
      }
      return null;
    }
    if(n.type==="CallExpression"){
      const args=n.arguments as unknown[];
      if(member(n.callee,"DIL","render"))return read(args[0],depth+1);
      if(obj(n.callee).name==="__dilSafe")return read(args[0],depth+1);
      if(member(n.callee,"__dil","jsx")){
        const first=obj(args[0]);
        if(first.type==="ArrowFunctionExpression"||first.type==="FunctionExpression")return read(first,depth+1);
        const name=member(first,"__dil","Fragment")?"fragment":first.type==="Identifier"?str(first.name):str(first.value);
        if(!name)throw Error("Unsupported UI component.");
        return {name,props:properties(args[1],depth+1),children:args.slice(2).map(a=>read(a,depth+1))};
      }
    }
    throw Error("Unsupported UI expression.");
  }
  for(const statement of ast.body){
    const s=obj(statement), expression=obj(s.expression);
    if(s.type==="ExpressionStatement"&&member(expression.callee,"DIL","render"))return read(expression);
  }
  throw Error("No declarative UI tree found.");
}

function staticHtml(tree: Ui, metadata: Obj, warnings: string[]): string {
  let count=0;
  function render(value: Ui, selected?: string): string {
    if(++count>30_000)throw Error("UI tree is too large.");
    if(value===null||typeof value==="boolean")return "";
    if(typeof value==="string"||typeof value==="number")return escape(value);
    if(Array.isArray(value))return value.map(v=>render(v,selected)).join("");
    const {name,props:p,children:c}=value;
    const inner=()=>c.map(v=>render(v,selected)).join("");
    switch(name){
      case "fragment": return inner();
      case "text":case "caption": {
        const color=colors[str(p.color)];
        const name=p.inline===true?"span":"p";
        return `<${name}${color?` style="color:${color}"`:""}>${inner()}</${name}>`;
      }
      case "bold":return `<strong>${inner()}</strong>`;
      case "italic":return `<em>${inner()}</em>`;
      case "strikethrough":return `<del>${inner()}</del>`;
      case "code":return `<code>${inner()}</code>`;
      case "code-block":return `<pre><code class="language-${escape(str(p.language).replace(/[^\w+-]/g,""))}">${inner()}</code></pre>`;
      case "title":return `<h${p.size==="lg"?2:3}>${inner()}</h${p.size==="lg"?2:3}>`;
      case "divider":return "<hr>";
      case "list":return p.marker==="number"?`<ol>${inner()}</ol>`:`<ul>${inner()}</ul>`;
      case "list-item":return `<li>${inner()}</li>`;
      case "table":return `<table>${inner()}</table>`;
      case "table-row":return `<tr>${inner()}</tr>`;
      case "table-cell":return p.header?`<th>${inner()}</th>`:`<td>${inner()}</td>`;
      case "quote":case "blockquote":return `<blockquote>${inner()}</blockquote>`;
      case "Link":case "link": {
        const url=safeLinkHref(str(p.url)||str(p.href));
        const label=inner()||escape(p.title||p.url||p.href);
        return url?`<a href="${escape(url)}">${label}</a>`:label;
      }
      case "MemoryCite":return "";
      case "Cite": {
        // Never print internal turn IDs. Keep actual citation URLs when supplied.
        const refs=new Set(Array.isArray(p.refs)?p.refs.map(String):[]);
        const groups=Array.isArray(metadata.search_result_groups)?metadata.search_result_groups:[];
        const citations=groups.slice(0,100).flatMap(g=>Array.isArray(obj(g).entries)?(obj(g).entries as unknown[]).slice(0,200):[]);
        const links=citations.flatMap(v=>{
          const citation=obj(v), ref=obj(citation.ref_id), id=`turn${ref.turn_index}${ref.ref_type}${ref.ref_index}`;
          const url=safeSourceUrl(str(citation.url));
          return refs.has(id)&&url?[`<a href="${escape(url)}">${escape(citation.title||new URL(url).hostname)}</a>`]:[];
        });
        return links.length?` (${links.slice(0,10).join("; ")})`:"";
      }
      case "icon": {
        const arrow:Record<string,string>={"arrow-down":"↓","arrow-up":"↑","arrow-right":"→"};
        return arrow[str(p.name)]?`<span>${arrow[str(p.name)]}</span>`:"";
      }
      case "pressable":return inner();
      case "box":case "row":case "column":case "col": {
        const content=inner();
        if(!content)return "";
        const styles:string[]=[];
        if(name==="row")styles.push("display:flex");
        if(p.border)styles.push("border:1px solid #777777");
        const bg=colors[str(p.background)];
        if(bg)styles.push(`background-color:${bg}`);
        if(name!=="row"&&p.align==="center")styles.push("text-align:center");
        return `<div${styles.length?` style="${styles.join(";")}"`:""}>${content}</div>`;
      }
      case "radio-group":return c.map(v=>render(v,str(p.value))).join("");
      case "radio":case "checkbox":return `<div role="${name}" aria-checked="${p.checked===true||(selected!==undefined&&p.value===selected)}">${inner()}</div>`;
      case "button":return /^(copy|copied)$/i.test(inner().replace(/<[^>]+>/g,"").trim())?"":`<div style="border:1px solid #777777;text-align:center">${inner()}</div>`;
      case "AsyncImage": {
        const model=obj(metadata.model_dil_v2),results=obj(obj(obj(model.appData).opGenui).componentResults);
        const state=obj(obj(results[str(p.__resolutionId)]).state);
        const images=Array.isArray(state.images)?state.images:[];
        const image=obj(images[0]),url=safeSourceUrl(str(image.content_url)||str(image.thumbnail_url));
        if(!url){warnings.push("An image-search component has no available public image URL.");return `<p>[Image unavailable: ${escape(p.query||"illustration")}]</p>`;}
        const size=obj(image.content_size);
        const dimension=(v:unknown)=>typeof v==="number"&&v>0&&v<20000?Math.round(v):undefined;
        const width=dimension(size.width),height=dimension(size.height),maxHeight=dimension(p.maxHeight);
        const scale=height&&maxHeight?Math.min(1,maxHeight/height):1;
        return `<figure><img src="${escape(url)}" alt="${escape(image.title||p.query||"Conversation illustration")}"${width?` width="${Math.round(width*scale)}"`:""}${height?` height="${Math.round(height*scale)}"`:""}></figure>`;
      }
      default:throw Error("Unsupported UI component: "+name);
    }
  }
  return render(tree);
}

function cleanFallback(source: string): string {
  return source.replace(/url([^]*)([^]*)/g,(_all,label:string,href:string)=>{
    const url=safeLinkHref(href);
    return url?`[${label.replace(/[\[\]]/g,"")}](${url.replace(/\(/g,"%28").replace(/\)/g,"%29")})`:label;
  }).replace(/(?:cite|image_group|navlist|entity)[\s\S]*?/g,"");
}

export function parseChatGPTRichMessage(source: string, metadataValue: unknown) {
  const metadata=obj(metadataValue),model=obj(metadata.model_dil_v2);
  if(typeof model.code!=="string")return parseRichMarkdown(source);
  const warnings:string[]=[];
  try {
    const html=staticHtml(staticTree(model.code,obj(model.constants)),metadata,warnings);
    const doc=parseHtmlTree(`<main>${html}</main>`);
    const main=descendants(doc,n=>tag(n)==="main")[0];
    const diagnostics={messages:warnings};
    const blocks:ContentBlock[]=parseSemanticBlocks(children(main),diagnostics);
    if(!blocks.length&&source.trim())throw Error("No readable UI content was recovered.");
    return {blocks,plainText:semanticBlocksToPlainText(blocks),warnings};
  }catch{
    if(typeof model.fallbackMarkdown==="string"&&model.fallbackMarkdown.trim()&&model.fallbackMarkdown.length<=1_000_000){
      const result=parseRichMarkdown(cleanFallback(model.fallbackMarkdown));
      result.warnings.push("An unsupported interactive component was converted using its supplied text alternative.");
      return result;
    }
    const result=parseRichMarkdown(source);
    result.warnings.push("Interactive rendering metadata was unsupported; original message text was preserved.");
    return result;
  }
}
