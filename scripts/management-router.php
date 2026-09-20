<?php
// Local production-build preview only. Production uses Apache's .htaccess.
$root=realpath(__DIR__.'/../dist');
return require __DIR__.'/protected-router.php';
