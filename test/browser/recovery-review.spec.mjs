import { readFile } from "node:fs/promises";
import { test, expect, arenaURL, nav, persisted } from "./helpers.mjs";
for (const failure of ["unavailable", "quota"]) {
  test("storage failure " + failure + " retains direct downloadable match export", async ({page}, info)=>{
    await page.addInitScript((failure)=>{
      if(failure==="unavailable") Object.defineProperty(window,"indexedDB",{value:undefined});
      else IDBObjectStore.prototype.put=function(){throw new DOMException("Test quota exhausted","QuotaExceededError");};
    },failure);
    await page.goto(arenaURL);
    await page.getByRole("button",{name:"开始新局",exact:true}).click();
    await expect(page.getByRole("button",{name:"已结束",exact:true})).toBeDisabled();
    await page.getByRole("button",{name:"保存 / 导出",exact:true}).click();
    await expect(page.getByLabel("回放时间")).toBeVisible();
    await expect(page.locator("#replay")).toContainText("未保存");
    const [download]=await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button",{name:"完整 JSON.gz",exact:true}).click(),
    ]);
    const path=info.outputPath(download.suggestedFilename()); await download.saveAs(path);
    expect((await readFile(path)).length).toBeGreaterThan(1000);
  });
}
test("older saved Arena records remain accessible beyond the latest thirty",async({page})=>{
  await page.goto(arenaURL);
  await persisted(page,async(s)=>{
    const info=await(await fetch(new URL("build-info.json",location.href))).json();
    const base=new URL("assets/"+info.buildHash+"/",location.href).href;
    const {createMatch}=await import(base+"engine/factory.js");
    const {buildReplayPackage}=await import(base+"replay/ledger.js");
    const m=createMatch({durationMs:10000});
    const pkg=buildReplayPackage({checkpoint:m.captureCheckpoint(),initialBoard:m.getInitialBoard(),ledger:[],snapshot:m.getSnapshot(),boardCheckpoints:[]});
    for(let i=0;i<35;i++) await s.putPackage({id:"older-"+String(i).padStart(3,"0"),type:"match",schemaVersion:3,index:{name:"Saved match "+i,timeMs:0,finished:false},payloadRefs:[]},pkg);
  });
  await nav(page,"replay");
  await expect(page.getByRole("button",{name:"加载更多",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"加载更多",exact:true}).click();
  await expect(page.getByText("Saved match 0",{exact:true})).toBeVisible();
});
