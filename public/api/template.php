<?php
declare(strict_types=1);
require_once __DIR__.'/form-access.php';
try{
    $identity=requireFormAccess();
    $id=$_GET['id']??'';
    if(!is_string($id)||!preg_match('/^[a-z][a-z0-9-]{1,79}$/D',$id))formAccessError('document_unavailable',404);
    // This old template remains readable only for the matching authenticated audience.
    $lookup=$id==='subscription-individual'?'subscription-form':$id;
    $defaults=json_decode(file_get_contents(__DIR__.'/defaults.json'),true,512,JSON_THROW_ON_ERROR);
    $document=null;foreach($defaults['documents'] as $candidate)if($candidate['id']===$lookup&&($candidate['builtin']??false)){$document=$candidate;break;}
    if(!$document)formAccessError('document_unavailable',404);
    if(!formDocumentAllowed($identity,$document))formAccessError('account_type_restricted',403);
    $file=__DIR__.'/../pdfs/'.$id.'.pdf';if(!is_file($file))formAccessError('document_unavailable',404);
    header('Content-Type: application/pdf');header('Content-Disposition: inline; filename="'.$id.'.pdf"');header('Content-Length: '.filesize($file));header('Cache-Control: private, no-store');header('X-Content-Type-Options: nosniff');
    readfile($file);
}catch(Throwable $error){error_log('Template access: '.$error->getMessage());formAccessError('server_error',500);}
