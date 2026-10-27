// Synthetic lesson exercising the component patterns seen in a shared chat.
const jsx=(name,props="null",...children)=>`__dil.jsx(${JSON.stringify(name)},${props}${children.length?","+children.join(","):""})`;
const text=s=>jsx("text","null",JSON.stringify(s));
export const learningGraph='flowchart TD\nA["Enter login"] --> B["Check database"]\nB --> C{"Details correct?"}\nC -->|Yes| D["Success"]\nC -->|No| E["Failure"]';
const source=`<CodeBlock language="mermaid" model_previewable>\n${learningGraph}\n</CodeBlock>`;
function metadata(tree,declarations="",images=[]){
 const componentResults=Object.fromEntries(images.map(id=>[id,{state:{images:[{content_url:`https://lesson-assets.example/${id}.png`,url:`https://sources.example/${id}`,title:`Illustration ${id}`,content_size:{width:360,height:180}}]}}]));
 return {model_dil_v2:{
  code:`DIL.render(__dil.jsx(()=>{const __dilConstants=DIL.useConstants();${declarations}return ${tree};}));`,
  constants:{refs:["turn42search0"]},fallbackMarkdown:"FALLBACK_SHOULD_NOT_REPLACE_THE_LESSON",
  appData:{opGenui:{componentResults}},clientDefinedWidgets:{graph:{refIndex:0}},
 },genui_components:[{type:"code_block",start_index:0,end_index:source.length}]};
}
const image=id=>`__dil.jsx(AsyncImage,{__resolutionId:${JSON.stringify(id)}})`;
export function learningExport(){
 const chapter1=jsx("fragment","null",jsx("title",'{size:"xl"}',JSON.stringify("System Design Lesson")),image("one"),image("two"),image("three"),
  jsx("radio-group",'{value:answer}',jsx("radio",'{value:"a"}',JSON.stringify("Load Balancer")),jsx("radio",'{value:"b"}',JSON.stringify("Database"))),
  `(answer==="b")?${text("Correct! A database stores data.")}:${text("Choose an answer")}`,
  '__dil.jsx(Cite,{refs:__dilConstants["refs"]})');
 const quiz=[{q:"Who sends requests?",opts:["Database","Client","Server"],correct:1},{q:"Where is business logic?",opts:["Application","Presentation","Data"],correct:0},{q:"Which means Not Found?",opts:["200","500","404"],correct:2}];
 const declarations=`const sections=["Client and server","Request-response cycle","HTTP basics","Three-tier architecture","Advantages"];
 const [checked,setChecked]=DIL.useState([false,false,false,false,false]);
 const done=__dilSafe(()=>checked.filter(Boolean).length,undefined);
 const quiz=${JSON.stringify(quiz)};const [answers,setAnswers]=DIL.useState({});`;
 const quizTree=`quiz.map((q,i)=>__dil.jsx("box",{border:true},__dil.jsx("text",null,i+1,". ",q.q),__dil.jsx("radio-group",{value:answers[i]===undefined?"":String(answers[i])},q.opts.map((option,j)=>__dil.jsx("radio",{value:String(j)},option)))))`;
 const chapter2=jsx("fragment","null",jsx("badge","null",JSON.stringify("Chapter 2")),
  jsx("box",'{border:true}',jsx("text","null",JSON.stringify("Chapter progress "),"done",JSON.stringify("/5 sections")),
   jsx("svg",'{viewBox:"0 0 320 14",width:"100%"}',jsx("rect",'{x:0,y:1,width:320,height:12,fill:"#cccccc"}'),jsx("rect",'{x:0,y:1,width:320*done/5,height:12,fill:"#16a34a"}')),
   'sections.map((section,i)=>__dil.jsx("checkbox",{checked:checked[i],onChange:()=>{throw Error("never run")}},section))'),
  image("four"),image("five"),
  jsx("math",'{block:true,value:"T_{total}=T_{network}+T_{server}+T_{database}"}'),
  jsx("text","null",jsx("math",'{value:"T_{network}"}'),JSON.stringify(" is network time")),
  jsx("text","null",jsx("math",'{value:"T_{server}"}'),JSON.stringify(" is server time")),
  jsx("text","null",jsx("math",'{value:"T_{database}"}'),JSON.stringify(" is database time")),
  jsx("math",`{block:true,value:${JSON.stringify("T_{total}=50+30+20=\\boxed{100\\text{ ms}}")}}`),
  jsx("__chatgptClientDefinedWidget",'{invocationId:"graph"}'),
  jsx("grid",'{columns:2}',jsx("grid-item","null",text("200")),jsx("grid-item","null",text("404")),jsx("grid-item","null",text("500")),jsx("grid-item","null",text("401"))),
  quizTree);
 const first=metadata(chapter1,'const [answer,setAnswer]=DIL.useState("b");',["one","two","three"]);
 first.search_result_groups=[{entries:[{ref_id:{turn_index:42,ref_type:"search",ref_index:0},url:"https://sources.example/lesson",title:"Lesson source"}]}];
 return {title:"System Design Fidelity",current_node:"a2",mapping:{
  u1:{parent:null,message:{id:"u1",author:{role:"user"},content:{parts:["Teach system design"]}}},
  a1:{parent:"u1",message:{id:"a1",author:{role:"assistant"},content:{parts:["Chapter one"]},metadata:first}},
  u2:{parent:"a1",message:{id:"u2",author:{role:"user"},content:{parts:["Include formulas, images, a quiz and progress"]}}},
  a2:{parent:"u2",message:{id:"a2",author:{role:"assistant"},content:{parts:[source]},metadata:metadata(chapter2,declarations,["four","five"])}},
 }};
}
