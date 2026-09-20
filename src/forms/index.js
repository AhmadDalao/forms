import './signature.js';
import './subscription.js';
import './terms.js';
import './individual-tax.js';
import './corporate-tax.js';
import './kyc-individual.js';
import './kyc-corporate.js';
import {docs} from '../schema.js';
import {applyPersonNameFields} from '../person-names.js';
import {applyPaperCopy} from './paper-copy.js';
import {applyCatalogueNames} from '../catalogue.js';
applyPaperCopy(docs);
{
 const d=docs.find(d=>d.id==='kyc-individual'),f=d.fields.find(f=>f.id==='city'),section=d.sections.find(s=>s.fields.includes(f));
 f.hidden=true;f.join=['address_city','address_district'];
 const parts=[['address_city','City','المدينة'],['address_district','District','الحي']].map(([id,label,ar])=>({id,label,ar,type:'text',page:f.page,rect:null,uiOnly:true}));
 d.fields.splice(d.fields.indexOf(f)+1,0,...parts);section.fields.splice(section.fields.indexOf(f)+1,0,...parts);
 for(const group of section.paperGroups||[])group.fields=group.fields.flatMap(id=>id==='city'?parts.map(f=>f.id):[id]);
}
// Change only the controls: the approved paper options and PDF destinations stay intact.
for(const doc of docs)for(const field of doc.fields){
 if(field.type==='choice'&&/(?:^|_)id_type$/.test(field.id))field.control='select';
 if(doc.id==='kyc-individual'&&field.id==='rep_type'){
  field.control='select';
  field.dropdownOptions=doc.fields.find(f=>f.id==='id_type').options.filter(o=>o.value!=='family').map(o=>({value:o.ar+' / '+o.label,label:o.label,ar:o.ar}));
 }
}
applyPersonNameFields(docs);
applyCatalogueNames(docs);
export {docs};
