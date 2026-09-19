<?php
declare(strict_types=1);
// This endpoint receives only a unit count. Customer details and signatures stay local.
function subscription_rules(): array { static $rules; return $rules ??= json_decode(file_get_contents(__DIR__.'/rules.json'),true,512,JSON_THROW_ON_ERROR); }
function subscription_under_thousand(int $n, bool $attached=false): string {
 $rules=subscription_rules(); $parts=[]; $h=intdiv($n,100);$r=$n%100;
 if($h)$parts[]=($h===2&&$r===0&&$attached)?'مائتا':$rules['hundreds'][$h];
 if($r<10){if($r)$parts[]=$rules['ones'][$r];}
 elseif($r<20)$parts[]=$rules['teens'][$r-10];
 else $parts[]=implode(' و',array_filter([$rules['ones'][$r%10],$rules['tens'][intdiv($r,10)]]));
 return implode(' و',$parts);
}
function subscription_words(int $amount): string {
 if($amount===0)return 'صفر ريال سعودي';$rules=subscription_rules();$parts=[];
 for($scale=count($rules['scales'])-1;$scale>=0;$scale--){
  $n=intdiv($amount,1000**$scale)%1000;if(!$n)continue;
  if(!$scale){$parts[]=subscription_under_thousand($n,true);continue;}
  [$one,$two,$many]=$rules['scales'][$scale];
  $parts[]=$n===1?$one:($n===2?$two:subscription_under_thousand($n,true).' '.($n%100>=3&&$n%100<=10?$many:$one));
 }
 return implode(' و',$parts).' ريال سعودي';
}
function subscription_calculate($value): array {
 $rules=subscription_rules();if(!is_string($value)&&!is_int($value))throw new InvalidArgumentException('units');
 $value=trim(strtr((string)$value,array_combine(preg_split('//u','٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹',-1,PREG_SPLIT_NO_EMPTY),str_split('01234567890123456789'))));
 $fixed=['fund_name'=>$rules['fundName'],'currency'=>$rules['currency'],'unit_price'=>(string)$rules['unitPrice']];
 if($value==='')return $fixed+['units'=>'','amount_subscribed'=>'','subscription_fee'=>'','total_amount'=>'','total_words'=>''];
 if(!preg_match('/^[0-9]+$/D',$value)||strlen(ltrim($value,'0'))>9)throw new InvalidArgumentException('units');
 $units=(int)$value;if($units<1||$units>$rules['maxUnits'])throw new InvalidArgumentException('units');
 $investment=$units*$rules['unitPrice'];$fee=intdiv($investment*$rules['feePercent'],100);$total=$investment+$fee;
 return $fixed+['units'=>(string)$units,'amount_subscribed'=>(string)$investment,'subscription_fee'=>(string)$fee,'total_amount'=>(string)$total,'total_words'=>subscription_words($total)];
}
if(PHP_SAPI==='cli')return;
header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store');header('X-Content-Type-Options: nosniff');
if($_SERVER['REQUEST_METHOD']!=='POST'){http_response_code(405);header('Allow: POST');echo '{"error":"method"}';exit;}
if(!str_starts_with(strtolower($_SERVER['CONTENT_TYPE']??''),'application/json')){http_response_code(415);echo '{"error":"content_type"}';exit;}
try{
 $body=file_get_contents('php://input',false,null,0,4097);
 if(strlen($body)>4096)throw new InvalidArgumentException('payload');
 $data=json_decode($body,true,16,JSON_THROW_ON_ERROR);
 if(!is_array($data))throw new InvalidArgumentException('payload');
 // Ignore all submitted prices, fees and totals: units are the only input.
 echo json_encode(subscription_calculate($data['units']??''),JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
}catch(Throwable $e){http_response_code(422);echo '{"error":"units"}';}
