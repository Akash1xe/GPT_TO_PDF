import { unzip } from "fflate";
import type { ExportCatalog } from "./export-conversation";
import { catalogChatGPTExports } from "./export-conversation";

export const MAX_UPLOAD_BYTES = 35_000_000;
const MAX_UNPACKED_BYTES = 50_000_000;
const MAX_ZIP_FILES = 30;
const MAX_COMPRESSION_RATIO = 500;
const MAX_JSON_CONVERSATIONS = 10_000;
const isConversationFile = (name:string) => /(?:^|\/)conversations(?:[-_]\d+)?\.json$/i.test(name.replace(/\\/g,"/"));

function decodeJson(bytes:Uint8Array):unknown {
 if(bytes.byteLength>MAX_UNPACKED_BYTES)throw Error("Export JSON exceeds the 50 MB limit.");
 const source=new TextDecoder("utf-8",{fatal:true}).decode(bytes);
 return JSON.parse(source) as unknown;
}

/**
 * Only decompress recognized conversation JSON files from ChatGPT exports.
 * All other user/account files inside the ZIP are excluded, not exposed.
 */
async function unzipConversations(bytes:Uint8Array):Promise<unknown[]> {
 let seen=0,total=0,rejection="";
 if(bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b ||
    bytes[2] !== 0x03 || bytes[3] !== 0x04) {
   throw Error("File does not contain a valid ZIP local-file header.");
 }
 const result=await new Promise<Record<string,Uint8Array>>((resolve,reject)=>{
  unzip(bytes,{
   filter(file){
    if(!isConversationFile(file.name))return false;
    seen++;
    if(seen>MAX_ZIP_FILES || !Number.isSafeInteger(file.originalSize) ||
      file.originalSize<0 || file.originalSize>MAX_UNPACKED_BYTES) {
      rejection="Too many/oversized conversation JSON files in ZIP.";
      return false;
    }
    if(file.originalSize>Math.max(1024,file.size)*MAX_COMPRESSION_RATIO) {
      rejection="Suspicious ZIP compression ratio; archive is not safe to unpack.";
      return false;
    }
    total+=file.originalSize;
    if(total>MAX_UNPACKED_BYTES) {
      rejection="Unpacked conversation JSON exceeds 50 MB.";
      return false;
    }
    return true;
   },
  },(error,files)=>error?reject(error):resolve(files));
 });
 if(rejection)throw Error(rejection);
 const parsed:unknown[]=[];
 for(const [name,data] of Object.entries(result)){
  if(!isConversationFile(name))continue;
  const json=decodeJson(data);
  if(Array.isArray(json)) {
    if(parsed.length+json.length>MAX_JSON_CONVERSATIONS)throw Error("Export contains too many conversations.");
    parsed.push(...json);
  } else {
    if(parsed.length>=MAX_JSON_CONVERSATIONS)throw Error("Export contains too many conversations.");
    parsed.push(json);
  }
 }
 return parsed;
}

export async function loadChatGPTExportFile(file:File):Promise<ExportCatalog>{
 if(file.size>MAX_UPLOAD_BYTES)throw Error("File exceeds the 35 MB local import limit.");
 const name=file.name.toLowerCase();
 if(!name.endsWith(".zip")&&!name.endsWith(".json"))throw Error("Choose a ChatGPT .zip export or conversations*.json file.");
 const bytes=new Uint8Array(await file.arrayBuffer());
 const parsed=name.endsWith(".zip")?await unzipConversations(bytes):decodeJson(bytes);
 return catalogChatGPTExports(parsed);
}
