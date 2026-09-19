<?php
declare(strict_types=1);

function migrateAccountTypes(): void {
    global $db;
    if((int)$db->query('PRAGMA user_version')->fetchColumn()>=2)return;
    $db->exec('BEGIN IMMEDIATE');
    try {
        if((int)$db->query('PRAGMA user_version')->fetchColumn()<2){
            $db->exec("ALTER TABLE users ADD COLUMN account_type TEXT NOT NULL DEFAULT 'individual' CHECK(account_type IN ('individual','corporate')); PRAGMA user_version=2;");
        }
        $db->exec('COMMIT');
    }catch(Throwable $e){$db->exec('ROLLBACK');throw $e;}
}

function accountType(mixed $value): string {
    if(!in_array($value,['individual','corporate'],true))reject('account_type_invalid');
    return $value;
}

function changeAccountType(string $id,string $type,string $expected): array {
    global $db;
    $db->exec('BEGIN IMMEDIATE');
    try {
        $user=execute('SELECT * FROM users WHERE id=?',[$id])->fetch();
        if(!$user)throw new DomainException('not_found');
        if($user['account_type']!==$expected)throw new DomainException('account_type_conflict');
        if($type!==$user['account_type']){
            execute('UPDATE users SET account_type=? WHERE id=?',[$type,$id]);
            execute('INSERT INTO audit(client_id,event,created_at) VALUES(?,?,?)',[$id,'owner_account_type:'.$expected.':'.$type,gmdate('Y-m-d\TH:i:s\Z')]);
        }
        $db->exec('COMMIT');$user['account_type']=$type;return $user;
    }catch(Throwable $e){$db->exec('ROLLBACK');throw $e;}
}
