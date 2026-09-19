<?php
declare(strict_types=1);

// The switch and decisions share SQLite's write lock. Switching modes never
// rewrites a submission's enrollment or any recorded review.
function migrateWorkflow(): void {
    global $db;
    if((int)$db->query('PRAGMA user_version')->fetchColumn()>=5)return;
    $db->exec('BEGIN IMMEDIATE');
    try {
        $version=(int)$db->query('PRAGMA user_version')->fetchColumn();
        if($version<4)throw new LogicException('Review migration must run before workflow migration');
        if($version<5){
            $db->exec("CREATE TABLE workflow_settings(
                id INTEGER PRIMARY KEY CHECK(id=1),
                review_enabled INTEGER NOT NULL CHECK(review_enabled IN (0,1)),
                revision INTEGER NOT NULL CHECK(revision>=0),
                updated_at TEXT,updated_by TEXT);
                INSERT INTO workflow_settings(id,review_enabled,revision) VALUES(1,1,0);
                CREATE TABLE workflow_setting_events(
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                review_enabled INTEGER NOT NULL CHECK(review_enabled IN (0,1)),
                revision INTEGER NOT NULL UNIQUE CHECK(revision>0),
                expected_revision INTEGER NOT NULL CHECK(expected_revision>=0 AND revision=expected_revision+1),
                admin_username TEXT NOT NULL,created_at TEXT NOT NULL,request_key TEXT NOT NULL,
                UNIQUE(admin_username,request_key));
                PRAGMA user_version=5;");
        }
        $db->exec('COMMIT');
    }catch(Throwable $e){$db->exec('ROLLBACK');throw $e;}
}

function workflowSettings(bool $admin=false): array {
    $row=execute('SELECT review_enabled,revision,updated_at,updated_by FROM workflow_settings WHERE id=1')->fetch();
    if(!$row)throw new LogicException('Workflow settings missing');
    $settings=['review_enabled'=>(bool)$row['review_enabled'],'revision'=>(int)$row['revision']];
    if($admin)$settings+=['updated_at'=>$row['updated_at'],'updated_by'=>$row['updated_by']];
    return $settings;
}

function workflowDetails(): array {
    $settings=workflowSettings(true);
    $events=execute('SELECT id,review_enabled,revision,admin_username,created_at FROM workflow_setting_events WHERE revision<=? ORDER BY revision DESC',[$settings['revision']])->fetchAll();
    foreach($events as &$event){$event['id']=(int)$event['id'];$event['revision']=(int)$event['revision'];$event['review_enabled']=(bool)$event['review_enabled'];}unset($event);
    return ['workflow'=>$settings,'history'=>$events];
}

function updateWorkflow(mixed $enabled,int $expected,string $key,string $actor): array {
    global $db;
    if(!is_bool($enabled)||$expected<0)throw new DomainException('invalid_request');
    $db->exec('BEGIN IMMEDIATE');
    try {
        $old=execute('SELECT * FROM workflow_setting_events WHERE admin_username=? AND request_key=?',[$actor,$key])->fetch();
        if($old){
            if((bool)$old['review_enabled']!==$enabled||(int)$old['expected_revision']!==$expected)throw new DomainException('workflow_conflict');
            $result=workflowDetails()+['duplicate'=>true];$db->exec('COMMIT');return $result;
        }
        $settings=workflowSettings();
        if($settings['revision']!==$expected)throw new DomainException('workflow_conflict');
        if($settings['review_enabled']===$enabled)throw new DomainException('workflow_unchanged');
        $revision=$expected+1;$now=gmdate('Y-m-d\TH:i:s\Z');
        execute('INSERT INTO workflow_setting_events(review_enabled,revision,expected_revision,admin_username,created_at,request_key) VALUES(?,?,?,?,?,?)',[(int)$enabled,$revision,$expected,$actor,$now,$key]);
        execute('UPDATE workflow_settings SET review_enabled=?,revision=?,updated_at=?,updated_by=? WHERE id=1',[(int)$enabled,$revision,$now,$actor]);
        $result=workflowDetails();$db->exec('COMMIT');return $result;
    }catch(Throwable $e){$db->exec('ROLLBACK');throw $e;}
}

// Only an explicit, server-recorded false opts a snapshot out. Legacy and
// malformed values retain the existing review workflow.
function workflowReviewRequired(array $snapshot): bool {
    $profile=$snapshot['profile']??[];
    if(is_string($profile))$profile=json_decode($profile,true);
    return !is_array($profile)||($profile['review_required']??true)!==false;
}
