<?php
declare(strict_types=1);
// Catalogue titles/order are editable. Built-in PDF geometry is release-owned.
function currentBuiltinPresentation(array $catalogue): array {
    $base=json_decode(file_get_contents(__DIR__.'/defaults.json'),true,512,JSON_THROW_ON_ERROR);
    $defaults=array_column($base['documents'],null,'id');
    foreach($catalogue['documents'] as &$document){
        $current=$defaults[$document['id']]??null;
        if(($document['builtin']??false)&&$current){
            // Replace only the retired default description; keep owner-written copy.
            if($document['id']==='terms-and-conditions'){
                $retired=['description'=>'Current PDF: Itqan’s general account terms and telephone / fax instructions.','arDescription'=>'الملف الحالي: شروط إتقان العامة للحساب وتعليمات الهاتف والفاكس.'];
                foreach($retired as $key=>$value)if(($document[$key]??null)===$value)$document[$key]=$current[$key];
            }
            foreach(['pages','pdfVersion','downloadOnly'] as $key){
                if(isset($current[$key]))$document[$key]=$current[$key];
            }
        }
    }
    unset($document);return $catalogue;
}
