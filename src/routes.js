export function audienceFor(pathname) {
  return /\/individuals\/?$/.test(pathname) ? 'individual'
    : /\/companies\/?$/.test(pathname) ? 'corporate' : null;
}
export function rootFor(pathname) {
  const root=pathname.replace(/(?:individuals|companies|management|login|register|account|my-applications)\/?$/, '');
  return root.endsWith('/') ? root : root+'/';
}
export const appRoot = typeof location==='undefined' ? '/' : rootFor(location.pathname);
export const storagePrefixFor=(root,prefix)=>['/','/forms/'].includes(root)?prefix:prefix+'site.'+encodeURIComponent(root)+'.';
export const draftStoragePrefix=storagePrefixFor(appRoot,'itqan.forms.v1.');
export const portalStoragePrefix=storagePrefixFor(appRoot,'itqan.portal.');
export const audience = typeof location==='undefined' ? null : audienceFor(location.pathname);
export const visibleIn = (doc, group) => Boolean(group) && (doc.group===group || doc.group==='shared');
export const accountFolder = user => user.account_type==='corporate'?'companies':'individuals';
export const canUseAudience = (user,group) => !user || user.account_type===group;
