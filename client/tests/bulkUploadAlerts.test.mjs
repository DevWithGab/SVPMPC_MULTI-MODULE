import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { createServer } from 'vite';
import Swal from 'sweetalert2';

test('payments and beneficiaries show modal-contained alerts for success, partial imports and request failures', async () => {
  const vite = await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
  const container = document.createElement('div'); document.body.append(container);
  const root = createRoot(container);
  const original = {fire:Swal.fire,show:window.HTMLDialogElement.prototype.showModal,close:window.HTMLDialogElement.prototype.close,act:globalThis.IS_REACT_ACT_ENVIRONMENT};
  const alerts=[];
  Swal.fire = async options => {alerts.push(options);return {isConfirmed:true};};
  window.HTMLDialogElement.prototype.showModal = function () {};
  window.HTMLDialogElement.prototype.close = function () {};
  globalThis.IS_REACT_ACT_ENVIRONMENT=true;
  const restores=[];
  try {
    const api=await vite.ssrLoadModule('/src/services/api.js');
    for(const [path,service,method,previewLabel,importLabel] of [
      ['/src/components/mortuary/treasurer/BulkPaymentUpload.jsx',api.treasurerAPI,'bulkUploadPayments','Preview Payments','Import 2 Payments'],
      ['/src/components/mortuary/admin/modals/BulkBeneficiaryUpload.jsx',api.beneficiaryAPI,'bulkUploadBeneficiaries','Preview Beneficiaries','Register 2 Beneficiaries'],
    ]) {
      const saved=service[method];restores.push(()=>{service[method]=saved;});
      let mode='partial';
      service[method]=async (_csv,action)=>{
        if(mode==='error') throw {response:{data:{message:'Upload service unavailable'}}};
        return {success:true,summary:{ready:action==='preview'?2:0,invalid:0,imported:action==='import'?mode==='empty'?0:mode==='partial'?1:2:0,failed:action==='import'&&mode==='partial'?1:0,duplicates:mode==='empty'?2:0},rows:[]};
      };
      const {default:Upload}=await vite.ssrLoadModule(path);
      await act(async()=>root.render(React.createElement(Upload,{key:path,onClose(){},onImported:async()=>{if(mode==='refresh')throw new Error('Refresh failed');}})));
      const button=label=>[...container.querySelectorAll('button')].find(node=>node.textContent.trim()===label);
      const choose=async()=>{
        const input=container.querySelector('input[type="file"]');
        Object.defineProperty(input,'files',{configurable:true,value:[{name:'test.csv',size:100,text:async()=>'test CSV'}]});
        await act(async()=>input.dispatchEvent(new window.Event('change',{bubbles:true})));
      };
      for(const scenario of ['partial','success','refresh','empty','error']) {
        mode=scenario;await choose();
        await act(async()=>button(previewLabel).click());
        if(mode!=='error') await act(async()=>button(importLabel).click());
        const alert=alerts.at(-1);
        assert.equal(alert.target,container.querySelector('dialog'));
        assert.equal(alert.heightAuto,false);
        assert.equal(alert.icon,mode==='error'?'error':mode==='partial'?'warning':mode==='empty'?'info':'success');
        if(mode==='refresh')assert.match(alert.text,/Refresh the page/);
        if(mode==='error')assert.match(container.querySelector('[role="alert"]').textContent,/Upload service unavailable/);
      }
    }
  } finally {
    for(const restore of restores)restore();
    await act(async()=>root.unmount());
    Swal.fire=original.fire;
    window.HTMLDialogElement.prototype.showModal=original.show;
    window.HTMLDialogElement.prototype.close=original.close;
    globalThis.IS_REACT_ACT_ENVIRONMENT=original.act;
    container.remove();await vite.close();
  }
});
