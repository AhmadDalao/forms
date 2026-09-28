#!/usr/bin/env python3
"""Package reviewed code/public build and an empty database. Never collects live data."""
from pathlib import Path
import argparse, hashlib, json, os, shutil, sqlite3, subprocess, zipfile
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args()
os.umask(0o077)
out = args.output.resolve()
if out.exists():
    parser.error('Choose a new output directory; existing deliveries are never overwritten.')
if not (ROOT / 'dist/api/portal.php').is_file():
    parser.error('Build and verify the application first.')
out.mkdir(parents=True)
package = out / 'developer-handoff'
package.mkdir()

def copy(source, target):
    if source.is_symlink():
        raise RuntimeError('Symlinks are not allowed in a delivery: ' + str(source))
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, target)

allowed_top = {'index.html', '.htaccess', '.user.ini', 'favicon.svg'}
allowed_dirs = {'assets', 'api', 'branding', 'pdfs', 'individuals', 'companies', 'management', 'login', 'register', 'account', 'my-applications'}
for file in (ROOT / 'dist').rglob('*'):
    if not file.is_file():
        continue
    rel = file.relative_to(ROOT / 'dist')
    if str(rel) == '_private/.htaccess' or str(rel) in allowed_top or rel.parts[0] in allowed_dirs:
        if file.suffix.lower() in {'.sqlite', '.db', '.zip', '.log', '.docx'}:
            raise RuntimeError('Private file in public delivery: ' + str(rel))
        copy(file, package / 'website' / rel)
for file in (package / 'website').rglob('*.html'):
    # Domain-specific canonical metadata is optional and must not name the old host.
    import re
    file.write_text(re.sub(r'\s*<link rel="canonical" href="[^"]*"\s*/>', '', file.read_text()))

# Explicit directories only. No .git, .env, node_modules, tmp, hosting records or private storage.
for folder in ['src', 'public', 'tests', 'reference/pdfs', 'reference/documents', 'scripts/pdf-design']:
    for file in (ROOT / folder).rglob('*'):
        if not file.is_file() or file.name == '.DS_Store' or '__pycache__' in file.parts:
            continue
        rel = file.relative_to(ROOT)
        if str(rel).startswith('public/_private/') and str(rel) != 'public/_private/.htaccess':
            continue
        copy(file, package / 'source' / rel)
scripts = ['build-folders.mjs', 'management-defaults.mjs', 'management-router.php', 'protected-router.php',
           'management-init.php', 'management-superadmin-init.php', 'installation-init.php', 'backup-installation.php',
           'restore-installation.php', 'export-private-migration.mjs', 'workflow-harness.mjs', 'admin-handoff-audit.mjs', 'current-pdf-audit.mjs',
           'current-pdf-audit-verify.py', 'preview-font-audit.mjs', 'preview-direction-audit.mjs',
           'client-corrections-audit.mjs', 'direct-intake-audit.mjs', 'form-access-audit.mjs', 'management-views-audit.mjs',
           'management-navigation-audit.mjs', 'catalogue-workflow-audit.mjs', 'admin-presentation-audit.mjs', 'loading-audit.mjs', 'customer-workflow-audit.mjs', 'notifications-audit.mjs', 'catalogue-layout-audit.mjs', 'client-preview-audit.mjs']
for name in scripts:
    copy(ROOT / 'scripts' / name, package / 'source/scripts' / name)
for name in ['package.json', 'package-lock.json', 'vite.config.js', 'index.html', '.gitignore']:
    copy(ROOT / name, package / 'source' / name)
documents = ['subscription-individual', 'subscription-company', 'al-naeem-terms-consent',
             'signature-form', 'kyc-individual', 'kyc-corporate', 'fatca-crs-individual',
             'fatca-crs-corporate', 'terms-and-conditions']
for name in documents:
    # The restored original T&C and signature PDFs have no matching Word sources; never ship the retired redesign as current.
    if name not in {'terms-and-conditions','signature-form'}:
        copy(ROOT / 'output/documents' / (name + '.docx'), package / 'editable-documents' / (name + '.docx'))
    copy(ROOT / 'public/pdfs' / (name + '.pdf'), package / 'editable-documents' / (name + '.pdf'))
copy(ROOT / 'docs/DEVELOPER-HANDOFF.md', package / 'INSTALL.md')
copy(ROOT / 'docs/DEVELOPER-HANDOFF.md', package / 'source/README.md')
copy(ROOT / 'docs/DEVELOPER-HANDOFF-AR.md', package / 'INSTALL-AR.md')
copy(ROOT / 'docs/HANDOVER-README.md', package / 'README.md')
copy(ROOT / 'docs/DEVELOPER-HANDOFF-AR.md', package / 'README-AR.md')
copy(ROOT / 'docs/DOMAIN-SETUP.md', package / 'DOMAIN-SETUP.md')
copy(ROOT / 'docs/DATABASE-HANDOFF.md', package / 'DATABASE.md')
copy(ROOT / 'docs/DATABASE-HANDOFF.md', package / 'database/README.md')
for name in ['modern-pdf-release-2026-09-28.md', 'modern-pdf-verification.json', 'terms-restoration-2026-09-28.md', 'terms-restoration-verification.json', 'bilingual-pdf-update-2026-09-28.md', 'bilingual-pdf-verification.json', 'pdf-layout-refinement-2026-09-28.md', 'pdf-layout-refinement-verification.json', 'full-regression-2026-09-28.md', 'full-regression-verification.json']:
    copy(ROOT / 'docs' / name, package / 'verification' / name)
copy(ROOT / 'docs/apache-vhost.example.conf', package / 'server/apache-vhost.conf')
copy(ROOT / 'docs/admin-presentation-verification.json', package / 'verification/admin-presentation-verification.json')

seed = out / 'empty-private'
subprocess.run(['php', str(ROOT / 'scripts/installation-init.php'), str(seed)], check=True)
for name, folder in [('clients', 'portal'), ('administrators', 'management')]:
    file = seed / folder / (name + '.sqlite')
    copy(file, package / 'database' / file.name)
    with sqlite3.connect(file) as db:
        if name == 'clients':
            assert db.execute('SELECT COUNT(*) FROM users').fetchone()[0] == 0
            assert db.execute('SELECT COUNT(*) FROM submissions').fetchone()[0] == 0
        sql = '\n'.join(db.iterdump()) + '\n'
    (package / 'database' / (name + '-schema.sql')).write_text(sql)
shutil.rmtree(seed)
files = []
for file in sorted(package.rglob('*')):
    if file.is_file():
        rel = str(file.relative_to(package))
        if any(part in {'.env', '.env.local', 'credentials.json', 'password.php', 'superadmin-password.php'} for part in file.relative_to(package).parts):
            raise RuntimeError('Credential file found in clean delivery: ' + rel)
        files.append({'path': rel, 'size': file.stat().st_size, 'sha256': hashlib.sha256(file.read_bytes()).hexdigest()})
manifest = {'created_at': datetime.now(timezone.utc).isoformat(),
            'source_commit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
            'contains_live_data': False, 'files': files}
(package / 'MANIFEST.json').write_text(json.dumps(manifest, indent=2) + '\n')
archive = out / 'developer-handoff.zip'
with zipfile.ZipFile(archive, 'x', zipfile.ZIP_DEFLATED) as z:
    for file in package.rglob('*'):
        if file.is_file():
            z.write(file, file.relative_to(out))
print('Clean developer package: ' + str(archive))
print('Existing client data must be exported separately to private-migration.zip.')
