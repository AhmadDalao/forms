#!/usr/bin/env python3
"""Upload only the production static build to the scoped Hostinger FTPS account."""
from pathlib import Path
import ftplib, ssl, shlex, hashlib, json, io
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
if (ROOT / 'src/management/main.js').exists():
    raise SystemExit('Management is a review-only branch. Production deployment is disabled until user approval.')
config = {}
for line in (ROOT / '.env.local').read_text().splitlines():
    if '=' in line and not line.lstrip().startswith('#'):
        key, value = line.split('=', 1)
        config[key.strip()] = shlex.split(value)[0] if value.strip() else ''

build = ROOT / 'dist'
files = [p for p in build.rglob('*') if p.is_file()]
allowed = {'.pdf', '.css', '.js', '.mjs', '.woff', '.woff2', '.svg'}
assert (build / 'index.html').is_file() and (build / '.htaccess').is_file(), 'Run npm run build first.'
for path in files:
    rel = path.relative_to(build)
    assert str(rel) in {'index.html', '.htaccess', 'individuals/index.html', 'companies/index.html'} or (rel.parts[0] in {'assets', 'pdfs'} and path.suffix in allowed) or str(rel) == 'favicon.svg', f'Unexpected public file: {rel}'
assert len(list((build / 'pdfs').glob('*.pdf'))) == 8

ftp = ftplib.FTP_TLS(context=ssl.create_default_context(), timeout=45)
ftp.connect(config['FTP_HOST'], int(config.get('FTP_PORT') or 21))
# Hostinger's certificate covers its server hostname, not the custom FTP alias.
# Keep chain + hostname verification enabled for both control and data channels.
ftp.host = 'cpl90.hosting24.com'
ftp.login(config['FTP_USERNAME'], config['FTP_PASSWORD'])
ftp.prot_p()
assert ftp.pwd() == '/', 'Unexpected FTP starting directory.'
print('Connected with verified TLS; account root is the forms directory.', flush=True)
stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
backup = ROOT / 'tmp' / 'deployment-backups' / stamp
backup.mkdir(parents=True, exist_ok=True)
for name in ['index.html', '.htaccess', 'individuals/index.html', 'companies/index.html']:
    data = io.BytesIO()
    try:
        ftp.retrbinary('RETR ' + name, data.write)
    except ftplib.error_perm as exc:
        if not str(exc).startswith('550'): raise
    else:
        (backup / name).parent.mkdir(parents=True, exist_ok=True)
        (backup / name).write_bytes(data.getvalue())
for directory in ['assets', 'pdfs', 'individuals', 'companies']:
    try: ftp.mkd(directory)
    except ftplib.error_perm as exc:
        if not str(exc).startswith('550'): raise

manifest = []
# Publish the entry point only once every dependency is present.
files.sort(key=lambda p: (p.name == 'index.html', p.name == '.htaccess', str(p)))
for path in files:
    relative = path.relative_to(build).as_posix()
    content = path.read_bytes()
    temporary = relative + '.upload-' + stamp
    ftp.storbinary('STOR ' + temporary, io.BytesIO(content))
    ftp.voidcmd('TYPE I')
    assert ftp.size(temporary) == len(content), f'Upload size mismatch: {relative}'
    ftp.rename(temporary, relative)
    manifest.append({'path': relative, 'bytes': len(content), 'sha256': hashlib.sha256(content).hexdigest()})
    print('Uploaded ' + relative, flush=True)
ftp.quit()
report = {'uploaded_at_utc': stamp, 'url': 'https://forms.ahmaddalao.com/', 'transport': 'Explicit FTPS with certificate verification', 'files': manifest}
(ROOT / 'docs' / 'deployment-manifest.json').write_text(json.dumps(report, indent=2) + '\n')
print('Upload complete. Verify the HTTPS site before announcing it live.', flush=True)
