#!/usr/bin/env python3
"""Deploy the public build to the scoped Hostinger account without replacing user data."""
from pathlib import Path
import argparse, ftplib, ssl, shlex, hashlib, json, io, os, subprocess
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--production', action='store_true', help='Explicitly select the main site, not the test preview.')
parser.add_argument('--credentials', type=Path, default=ROOT / '.env.local')
parser.add_argument('--initialize-management', type=Path, help='Existing owner credential directory; used only if production has no credentials.')
parser.add_argument('--initialize-superadmin', type=Path, help='Add an explicitly configured superadmin from a private directory; never replace existing credentials.')
args = parser.parse_args()
if not args.production:
    parser.error('Pass --production only when the user has authorized publishing to the main site.')
os.umask(0o077)
config = {}
for line in args.credentials.read_text().splitlines():
    if '=' in line and not line.lstrip().startswith('#'):
        key, value = line.split('=', 1)
        config[key.strip()] = shlex.split(value)[0] if value.strip() else ''

build = ROOT / 'dist'
assert (build / 'index.html').is_file(), 'Run npm run build first.'
routes = {'index.html', '.htaccess', '.user.ini', 'favicon.svg', '_private/.htaccess'}
routes.update(folder + '/index.html' for folder in ['individuals', 'companies', 'management', 'login', 'register', 'account', 'my-applications'])
allowed = {'assets': {'.js', '.mjs', '.css', '.woff', '.woff2', '.svg'}, 'pdfs': {'.pdf'}, 'branding': {'.png', '.svg'}, 'api': {'.php', '.json'}}
files = {}
for path in build.rglob('*'):
    if not path.is_file():
        continue
    rel = path.relative_to(build).as_posix()
    # Development servers can create local databases in dist. Never deploy them.
    if rel.startswith('_private/') and rel != '_private/.htaccess':
        continue
    assert rel in routes or (rel.split('/')[0] in allowed and path.suffix in allowed[rel.split('/')[0]]), f'Unexpected public file: {rel}'
    assert not path.is_symlink(), f'Unexpected symlink: {rel}'
    data = path.read_bytes()
    if path.suffix == '.html':
        assert b'Test preview' not in data and b'preview-20260919' not in data, 'Preview HTML cannot be published to production.'
    files[rel] = data
assert all(name in files for name in routes)
assert files['_private/.htaccess'].strip() == b'Require all denied'
for value in [config.get('FTP_PASSWORD'), config.get('DB_PASSWORD')]:
    if value:
        assert not any(value.encode() in data for data in files.values()), 'Credential found in public build.'

stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
backup = ROOT / 'tmp' / 'deployment-backups' / stamp
backup.mkdir(parents=True, exist_ok=False)
report = {'uploaded_at_utc': stamp, 'url': 'https://forms.ahmaddalao.com/', 'source_commit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(), 'transport': 'Explicit FTPS with verified Hostinger certificate', 'backup': str(backup), 'files': [], 'created': [], 'replaced': [], 'unchanged': []}
ftp = ftplib.FTP_TLS(context=ssl.create_default_context(), timeout=60)
ftp.connect(config['FTP_HOST'], int(config.get('FTP_PORT') or 21))
ftp.host = 'hstgr.io'
ftp.login(config['FTP_USERNAME'], config['FTP_PASSWORD'])
ftp.prot_p()
assert ftp.pwd() == '/', 'Unexpected FTP root.'
known_dirs = {''}

def read(name):
    output = io.BytesIO()
    try:
        ftp.retrbinary('RETR ' + name, output.write)
    except ftplib.error_perm as exc:
        if str(exc).startswith('550'):
            return None
        raise
    return output.getvalue()

def mkdirs(name):
    parent = ''
    for part in Path(name).parts[:-1]:
        parent = parent + '/' + part if parent else part
        if parent in known_dirs:
            continue
        try:
            ftp.mkd(parent)
        except ftplib.error_perm:
            # Verify an existing directory, rather than swallowing any permission error.
            ftp.cwd('/' + parent)
            ftp.cwd('/')
        known_dirs.add(parent)

def persist_report():
    (backup / 'manifest.json').write_text(json.dumps(report, indent=2) + '\n')

def upload(name, data, private=False):
    previous = read(name)
    if previous == data:
        report['unchanged'].append(name)
        return
    if previous is not None:
        saved = backup / name
        saved.parent.mkdir(parents=True, exist_ok=True)
        saved.write_bytes(previous)
        report['replaced'].append(name)
    else:
        report['created'].append(name)
    persist_report()  # Record a recovery path before changing the remote file.
    mkdirs(name)
    temporary = name + '.upload-' + stamp
    ftp.storbinary('STOR ' + temporary, io.BytesIO(data))
    ftp.voidcmd('TYPE I')
    assert ftp.size(temporary) == len(data), 'Upload size mismatch: ' + name
    ftp.rename(temporary, name)
    assert read(name) == data, 'Upload content mismatch: ' + name
    if private:
        ftp.sendcmd('SITE CHMOD 600 ' + name)
    print('Uploaded ' + name, flush=True)

def credential_username(data):
    # Evaluate only the guarded credential file produced by our local setup command.
    local = backup / 'credential-username.php'
    local.write_bytes(data)
    try:
        return subprocess.check_output(['php', '-r', "define('FORMS_MANAGEMENT_AUTH',true); echo mb_strtolower(trim(require $argv[1]),'UTF-8');", str(local)], text=True)
    finally:
        local.unlink()

try:
    credentials = {name: read('_private/management/' + name) for name in ['username.php', 'password.php']}
    super_credentials = {name: read('_private/management/' + name) for name in ['superadmin-username.php', 'superadmin-password.php']}
    assert args.initialize_superadmin or not any(super_credentials.values()) or all(super_credentials.values()), 'Production superadmin configuration is incomplete; supply the matching private bootstrap to finish it.'
    if any(credentials.values()):
        assert all(credentials.values()), 'Production owner configuration is incomplete; refusing to overwrite it.'
        bootstrap = {}
    else:
        assert args.initialize_management, 'Production needs an explicitly supplied owner credential directory.'
        bootstrap = {name: (args.initialize_management / name).read_bytes() for name in credentials}
        assert all(data.startswith(b'<?php') and b'FORMS_MANAGEMENT_AUTH' in data for data in bootstrap.values())
    super_bootstrap = {}
    if args.initialize_superadmin:
        supplied = {name: (args.initialize_superadmin / name).read_bytes() for name in super_credentials}
        assert all(data.startswith(b'<?php') and b'FORMS_MANAGEMENT_AUTH' in data for data in supplied.values()), 'Invalid private superadmin credential files.'
        assert credential_username(supplied['superadmin-username.php']) != credential_username(credentials['username.php'] or bootstrap['username.php']), 'Superadmin and admin usernames must be different.'
        for name, data in supplied.items():
            existing = super_credentials[name]
            assert existing is None or existing == data, 'A different superadmin credential already exists; refusing to overwrite it.'
            if existing is None:
                super_bootstrap[name] = data
    # Protect private storage before placing owner credentials or enabling the APIs.
    upload('_private/.htaccess', files['_private/.htaccess'])
    for name, data in bootstrap.items():
        upload('_private/management/' + name, data, private=True)
    for name, data in super_bootstrap.items():
        upload('_private/management/' + name, data, private=True)
    # Install the authenticated document/page gateway before activating rewrites.
    for name in ['api/form-access.php', 'api/page.php', 'api/template.php']:
        upload(name, files[name])
    upload('.htaccess', files['.htaccess'])
    # Existing API entrypoints may still be serving requests during this upload.
    # Publish the workflow dependency before the version/review helpers use it.
    upload('api/portal-workflow.php', files['api/portal-workflow.php'])
    # Immutable assets and PHP dependencies precede the new HTML entrypoints.
    for name, data in sorted(files.items(), key=lambda item: (item[0].endswith('.html'), item[0] == 'index.html', item[0])):
        if name in ['_private/.htaccess', '.htaccess', 'api/portal-workflow.php', 'api/form-access.php', 'api/page.php', 'api/template.php']:
            continue
        upload(name, data)
    for name, data in files.items():
        report['files'].append({'path': name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
    for name, original in credentials.items():
        if original:
            assert read('_private/management/' + name) == original, 'Owner credentials changed unexpectedly.'
    for name, original in {**super_credentials, **super_bootstrap}.items():
        if original:
            assert read('_private/management/' + name) == original, 'Superadmin credentials changed unexpectedly.'
    report['completed'] = True
    persist_report()
    (ROOT / 'docs' / 'deployment-manifest.json').write_text(json.dumps(report, indent=2) + '\n')
    print('Production upload complete. Verify HTTPS routes, privacy and account workflows.', flush=True)
finally:
    ftp.close()
