export function audienceFor(pathname) {
  return /\/individuals\/?$/.test(pathname) ? 'individual'
    : /\/companies\/?$/.test(pathname) ? 'corporate' : null;
}
export function rootFor(pathname) {
  const root=pathname.replace(/(?:individuals|companies|management|login|register|account|my-applications)\/?$/, '');
  return root.endsWith('/') ? root : root+'/';
}
export const appRoot = typeof location==='undefined' ? '/' : rootFor(location.pathname);
export const audience = typeof location==='undefined' ? null : audienceFor(location.pathname);
export const visibleIn = (doc, group) => Boolean(group) && (doc.group===group || doc.group==='shared');
