import { test, expect } from "@playwright/test";
import { zipSync, strToU8 } from "fflate";

function exported(title="Selected conversation") {
 return {title,id:"selected-chat",current_node:"a1",mapping:{
  root:{id:"root",parent:null,message:null},
  u1:{id:"u1",parent:"root",message:{id:"u1",author:{role:"user"},content:{content_type:"text",parts:["What is a **binary search**?"]}}},
  a1:{id:"a1",parent:"u1",message:{id:"a1",author:{role:"assistant"},content:{content_type:"text",parts:["## Result\n\nUse a sorted array.\n\n\`\`\`cpp\nint mid = 2;\n\`\`\`"]}}},
  a2:{id:"a2",parent:"u1",message:{id:"a2",author:{role:"assistant"},content:{content_type:"text",parts:["Unselected regenerated answer"]}}},
 }};
}

test("uploading ChatGPT export JSON selects branch and opens printable PDF view",async({page})=>{
 await page.goto("/#import-studio");
 await page.locator("#conversation-file").setInputFiles({
  name:"conversations.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify([exported()])),
 });
 await expect(page.locator("#export-choice")).toBeVisible();
 await expect(page.getByText("Selected conversation",{exact:true})).toBeVisible();
 await expect(page.getByText("Use a sorted array.",{exact:false}).first()).toBeVisible();
 await expect(page.getByText("Unselected regenerated answer")).toHaveCount(0);
 const popupPromise=page.waitForEvent("popup");
 await page.getByRole("button",{name:"Open print preview / Save as PDF"}).click();
 const popup=await popupPromise;
 await expect(popup.locator(".export-document .message")).toHaveCount(2);
 await expect(popup.locator(".export-document .code-block")).toHaveCount(1);
 await expect(popup.locator(".export-document")).not.toContainText("Unselected regenerated answer");
 await popup.close();
});

test("upload ZIP export and paste a labeled Markdown conversation locally",async({page})=>{
 await page.goto("/#import-studio");
 const zip=zipSync({
  "conversations.json":strToU8(JSON.stringify([exported("ZIP Imported Conversation")])),
  "user.json":strToU8(JSON.stringify({email:"secret@example.net"})),
 });
 await page.locator("#conversation-file").setInputFiles({
  name:"chatgpt-export.zip",mimeType:"application/zip",buffer:Buffer.from(zip),
 });
 await expect(page.getByText("ZIP Imported Conversation",{exact:true})).toBeVisible();
 await expect(page.getByText("secret@example.net")).toHaveCount(0);
 await page.locator("#paste-content").fill("User:\nHello there.\n\nAssistant:\n## Greeting\n\nWelcome to the **site**.");
 await page.getByRole("button",{name:"Import pasted content"}).click();
 await expect(page.getByText("Pasted conversation",{exact:true})).toBeVisible();
 await expect(page.getByText("Welcome to the site.",{exact:false})).toBeVisible();
 await expect(page.locator("#export-choice")).toHaveCount(0);
});
