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
applyPersonNameFields(docs);
applyCatalogueNames(docs);
export {docs};
