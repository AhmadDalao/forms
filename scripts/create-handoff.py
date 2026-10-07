#!/usr/bin/env python3
"""Package the public build and an explicitly supplied, verified fresh admin bootstrap."""
from pathlib import Path
import argparse, hashlib, json, os, shutil, sqlite3, subprocess, zipfile
from datetime import date, datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output', type=Path, required=True)
parser.add_argument('--bootstrap', type=Path, required=True, help='Private fresh-install ZIP, never a live client export')
parser.add_argument('--snapshot', type=Path, required=True, help='Metadata/checksum for that bootstrap')
parser.add_argument('--release-date', type=date.fromisoformat, default=date.today(), help='Delivery date, YYYY-MM-DD')
args = parser.parse_args()
release_date = args.release_date.isoformat()
os.umask(0o077)
out = args.output.resolve()
bootstrap = args.bootstrap.resolve()
snapshot = json.loads(args.snapshot.read_text())
if (snapshot.get('contains_client_data') is not False
        or any(snapshot.get('counts', {}).get(key) != 0 for key in ['users', 'submissions', 'client_shared_profiles', 'archived_versions'])
        or snapshot.get('sha256') != hashlib.sha256(bootstrap.read_bytes()).hexdigest()
        or sorted((row['username'], row['role']) for row in snapshot.get('management_accounts', [])) != [('admin', 'admin'), ('superadmin', 'superadmin')]):
    parser.error('A verified, zero-client bootstrap containing admin and superadmin is required.')
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
           'rebuild-subscription.py', 'update-original-footers.py', 'verify-national-address.py',
           'management-init.php', 'management-superadmin-init.php', 'installation-init.php', 'backup-installation.php',
           'restore-installation.php', 'export-private-migration.mjs', 'workflow-harness.mjs', 'admin-handoff-audit.mjs', 'current-pdf-audit.mjs',
           'current-pdf-audit-verify.py', 'preview-font-audit.mjs', 'preview-direction-audit.mjs',
           'client-corrections-audit.mjs', 'direct-intake-audit.mjs', 'form-access-audit.mjs', 'management-views-audit.mjs',
           'management-navigation-audit.mjs', 'catalogue-workflow-audit.mjs', 'admin-presentation-audit.mjs', 'loading-audit.mjs', 'customer-workflow-audit.mjs', 'notifications-audit.mjs', 'catalogue-layout-audit.mjs', 'client-preview-audit.mjs', 'staff-name-audit.mjs', 'review-navigation-audit.mjs', 'optional-review-audit.mjs', 'optional-review-actions-audit.mjs', 'submit-only-client-audit.mjs', 'shared-profiles-audit.mjs']
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
for name in ['DEVELOPER-REVIEW.md', 'TESTING.md', 'TEST-REPORT.md', 'PERFORMANCE.md', 'HOSTING-ACCESS.md', 'REVIEW-WORKFLOW.md']:
    copy(ROOT / 'docs' / name, package / name)
for name in ['modern-pdf-release-2026-09-28.md', 'modern-pdf-verification.json', 'terms-restoration-2026-09-28.md', 'terms-restoration-verification.json', 'bilingual-pdf-update-2026-09-28.md', 'bilingual-pdf-verification.json', 'pdf-layout-refinement-2026-09-28.md', 'pdf-layout-refinement-verification.json', 'full-regression-2026-09-28.md', 'full-regression-verification.json']:
    copy(ROOT / 'docs' / name, package / 'verification' / name)
copy(ROOT / 'docs/apache-vhost.example.conf', package / 'server/apache-vhost.conf')
copy(ROOT / 'docs/admin-presentation-verification.json', package / 'verification/admin-presentation-verification.json')
copy(ROOT / 'docs/received-names-2026-09-30.json', package / 'verification/received-names-2026-09-30.json')
copy(ROOT / 'docs/kyc-address-verification-2026-10-07.json', package / 'verification/kyc-address-verification-2026-10-07.json')
copy(ROOT / 'docs/all-forms-address-verification-2026-10-07.json', package / 'verification/all-forms-address-verification-2026-10-07.json')
for name in ['customer-workflow-release-2026-09-28.md', 'customer-workflow-verification.json',
             'current-documents-2026-09-28.md', 'current-documents-verification.json', 'current-documents-live-verification.json',
             'roomy-cards-2026-09-28.md', 'roomy-cards-verification.json', 'roomy-cards-live-verification.json',
             'latest-client-preview-2026-09-28.md', 'latest-client-preview-verification.json', 'latest-client-preview-live-verification.json',
             'handover-verification-2026-09-29.json', 'live-loading-2026-09-29.json', 'optional-review-verification-2026-09-29.json', 'optional-review-live-2026-09-29.json', 'review-navigation-verification-2026-09-29.json', 'review-navigation-live-2026-09-29.json', 'submission-settings-verification-2026-09-29.json', 'submission-settings-live-2026-09-29.json', 'category-order-verification-2026-09-29.json', 'category-order-live-2026-09-29.json', 'submit-only-cycle-verification-2026-09-29.json', 'submit-only-cycle-live-2026-09-29.json']:
    copy(ROOT / 'docs' / name, package / 'verification' / name)

# Verify the actual private archive, not just its label, before including it.
restored = out / 'verified-private'
subprocess.run(['php', str(ROOT / 'scripts/restore-installation.php'), str(bootstrap), str(restored)], check=True)
subprocess.run(['php', str(ROOT / 'scripts/installation-init.php'), str(restored)], check=True)
with sqlite3.connect(restored / 'portal/clients.sqlite') as db:
    for table in ['users', 'submissions', 'client_shared_profiles', 'submission_reviews', 'audit', 'rates']:
        assert db.execute('SELECT COUNT(*) FROM ' + table).fetchone()[0] == 0, table
    assert db.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
    assert db.execute('PRAGMA user_version').fetchone()[0] == snapshot['schema_version'] == 8
    assert db.execute('SELECT review_enabled FROM workflow_settings WHERE id=1').fetchone()[0] == 0
with sqlite3.connect(restored / 'management/administrators.sqlite') as db:
    assert db.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
    for table in ['administrators', 'administrator_events']:
        assert db.execute('SELECT COUNT(*) FROM ' + table).fetchone()[0] == 0, table
for name in ['username.php', 'password.php', 'superadmin-username.php', 'superadmin-password.php']:
    assert (restored / 'management' / name).is_file(), name
assert not list((restored / 'portal/pdfs').glob('*'))
assert not list((restored / 'management/uploads').glob('*'))
assert not (restored / 'management/state.json').exists()
shutil.rmtree(restored)
copy(bootstrap, package / 'private-bootstrap.zip')
snapshot['application_release'] = release_date + ' updated Itqan national address on every form, submit-only client display, dedicated submission settings and schema 8'
snapshot['application_commit'] = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
(package / 'SNAPSHOT.json').write_text(json.dumps(snapshot, indent=2) + '\n')
(package / ('verification/bootstrap-verification-' + release_date + '.json')).write_text(json.dumps({
    'verified_at': datetime.now(timezone.utc).isoformat(), 'restored_and_initialized': True,
    'client_schema_version': 8, 'review_enabled': False,
    'client_tables_empty': True, 'pdfs_empty': True, 'catalogue_state_empty': True,
    'sqlite_integrity_passed': True, 'management_hash_files_present': True,
    'bootstrap_sha256': snapshot['sha256'], 'contains_client_data': False,
    'note': 'Original bootstrap credential hashes preserved. Synthetic admin/password/restore workflows are recorded separately.'
}, indent=2) + '\n')

seed = out / 'empty-private'
subprocess.run(['php', str(ROOT / 'scripts/installation-init.php'), str(seed)], check=True)
for name, folder in [('clients', 'portal'), ('administrators', 'management')]:
    file = seed / folder / (name + '.sqlite')
    copy(file, package / 'database' / file.name)
    with sqlite3.connect(file) as db:
        if name == 'clients':
            assert db.execute('PRAGMA user_version').fetchone()[0] == 8
            assert db.execute('SELECT review_enabled FROM workflow_settings WHERE id=1').fetchone()[0] == 0
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
            'contains_client_data': False, 'contains_management_credentials': True,
            'includes_management_accounts': ['admin', 'superadmin'], 'files': files}
(package / 'MANIFEST.json').write_text(json.dumps(manifest, indent=2) + '\n')
(package / 'SHA256SUMS.txt').write_text(''.join(f"{f['sha256']}  {f['path']}\n" for f in files))
archive = out / ('Al-Naeem-Developer-Handover-' + release_date + '.zip')
with zipfile.ZipFile(archive, 'x', zipfile.ZIP_DEFLATED) as z:
    for file in package.rglob('*'):
        if file.is_file():
            z.write(file, file.relative_to(out))
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
print('Fresh developer package: ' + str(archive))
print('Includes admin/superadmin hashes; contains no clients or submitted forms. Keep the ZIP private.')
