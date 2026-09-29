# Access required from the hosting client

We can deploy the website, initialize/restore its SQLite databases, configure storage, connect the domain, enable HTTPS and test the installed workflows when the following access is available.

| Request | Why it is needed |
|---|---|
| Domain/subdomain and intended URL | Configure the correct site and links |
| SFTP or FTPS hostname, port, username, credential/key and permitted paths | Upload public files and private seed securely |
| Hosting control-panel access or an authorized collaborator invitation | Create the website, select PHP/extensions, manage SSL and identify the document root |
| SSH/terminal access, or provider assistance executing the included PHP commands | Restore and verify the private databases, set permissions and configure PHP |
| DNS access, or someone authorized to update the records | Point the hostname at the hosting server |
| Persistent private directory outside the document root, writable by PHP | Store account hashes, SQLite databases and future submissions |

## Is FTP alone enough?

FTP handles file transfer. It does not itself grant control-panel, DNS, SSL, PHP configuration or terminal access. It can be sufficient for uploading to a server the provider has **already fully configured**, including protected private storage and the required PHP environment settings. Otherwise request control-panel/SSH access or have the provider complete those steps.

The databases can be initialized locally and uploaded while the new site is closed, but the server must still support PDO SQLite, correct permissions and the private paths. The supported, verified installation route is the CLI restore in `INSTALL.md`; do not add a public web-based database installer or upload credentials into the public web root as a workaround.

This project uses SQLite files. You do **not** need to create a MySQL database through the hosting panel. A static-only host is insufficient; PHP hosting is required.

For Hostinger, SSH/SFTP availability depends on the hosting plan. The provider explains its file-transfer and server-access options here: https://www.hostinger.com/support/which-file-transfer-and-server-access-options-are-supported-at-hostinger/ . Check the actual plan rather than assuming an FTP account includes SSH.

The package already provisions `admin` and `superadmin`. Existing passwords continue to work. Exchange access credentials privately with the owner; they are not printed in this delivery.

## متطلبات الوصول بالعربية

نحتاج النطاق المطلوب، وبيانات SFTP أو FTPS، وصلاحية لوحة الاستضافة أو SSH لضبط PHP والتخزين الخاص وHTTPS، وصلاحية DNS أو شخص يطبق تغييرات النطاق. حساب FTP مخصص لنقل الملفات، ولا يمنح تلقائيًا صلاحيات النطاق أو SSL أو إعدادات PHP. إذا كانت الاستضافة مجهزة بالكامل فقد يكفي للرفع؛ وإلا يلزم تدخل صاحب الاستضافة أو مزودها. قاعدة المشروع SQLite جاهزة، ولا نحتاج إنشاء قاعدة MySQL. يجب أن تبقى ملفات الحسابات والقواعد خارج المجلد العام للموقع.
