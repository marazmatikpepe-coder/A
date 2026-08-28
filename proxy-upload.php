<?php
// proxy-upload.php - прокси для загрузки изображений на ImgBB
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit();
}

$input = json_decode(file_get_contents('php://input'), true);
$imageUrl = $input['imageUrl'] ?? '';

if (empty($imageUrl)) {
    http_response_code(400);
    echo json_encode(['error' => 'No image URL provided']);
    exit();
}

$apiKey = 'd8a9dad272290e9bd78173da55a97d77';

// Скачиваем картинку через curl, а не file_get_contents:
// на многих хостингах allow_url_fopen отключён или устарел набор корневых
// сертификатов для https-потоков — file_get_contents в таких случаях просто
// тихо возвращает false без внятной причины. curl работает надёжнее и даёт
// понятную диагностику.
$dlCh = curl_init();
curl_setopt($dlCh, CURLOPT_URL, $imageUrl);
curl_setopt($dlCh, CURLOPT_RETURNTRANSFER, true);
curl_setopt($dlCh, CURLOPT_FOLLOWLOCATION, true);
curl_setopt($dlCh, CURLOPT_MAXREDIRS, 5);
curl_setopt($dlCh, CURLOPT_TIMEOUT, 30);
curl_setopt($dlCh, CURLOPT_SSL_VERIFYPEER, false);
curl_setopt($dlCh, CURLOPT_SSL_VERIFYHOST, 0);
curl_setopt($dlCh, CURLOPT_USERAGENT, 'Mozilla/5.0 (compatible; AKUR-ImageProxy/1.0)');
$imageData = curl_exec($dlCh);
$dlHttpCode = curl_getinfo($dlCh, CURLINFO_HTTP_CODE);
$dlError = curl_error($dlCh);
curl_close($dlCh);

if ($imageData === false || $imageData === '') {
    http_response_code(400);
    echo json_encode([
        'error' => 'Не удалось скачать изображение по ссылке: ' . ($dlError ?: "пустой ответ (HTTP $dlHttpCode)"),
        'stage' => 'download',
        'source_url' => $imageUrl
    ]);
    exit();
}
if ($dlHttpCode < 200 || $dlHttpCode >= 300) {
    http_response_code(400);
    echo json_encode([
        'error' => "Сервер-источник вернул HTTP $dlHttpCode при скачивании изображения",
        'stage' => 'download',
        'source_url' => $imageUrl
    ]);
    exit();
}

$finfo = new finfo(FILEINFO_MIME_TYPE);
$mimeType = $finfo->buffer($imageData);

if (strpos($mimeType, 'image/') !== 0) {
    http_response_code(400);
    echo json_encode([
        'error' => "Скачанный файл — не изображение (определён тип: $mimeType)",
        'stage' => 'download',
        'source_url' => $imageUrl
    ]);
    exit();
}

$extension = explode('/', $mimeType)[1] ?? 'jpg';

$boundary = '----WebKitFormBoundary' . bin2hex(random_bytes(16));

$postFields = "--$boundary\r\n";
$postFields .= "Content-Disposition: form-data; name=\"key\"\r\n\r\n";
$postFields .= "$apiKey\r\n";
$postFields .= "--$boundary\r\n";
$postFields .= "Content-Disposition: form-data; name=\"image\"; filename=\"poster.$extension\"\r\n";
$postFields .= "Content-Type: $mimeType\r\n\r\n";
$postFields .= $imageData . "\r\n";
$postFields .= "--$boundary--\r\n";

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, 'https://api.imgbb.com/1/upload');
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $postFields);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "Content-Type: multipart/form-data; boundary=$boundary",
    'Content-Length: ' . strlen($postFields)
]);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
curl_setopt($ch, CURLOPT_TIMEOUT, 30);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

if ($response === false) {
    http_response_code(500);
    echo json_encode(['error' => 'Ошибка соединения с ImgBB: ' . $curlError, 'stage' => 'upload']);
    exit();
}

$data = json_decode($response, true);

if ($httpCode !== 200 || !isset($data['data']['url'])) {
    http_response_code($httpCode ?: 500);
    $imgbbMsg = $data['error']['message'] ?? $response;
    echo json_encode([
        'error' => "Ошибка ImgBB (HTTP $httpCode): $imgbbMsg",
        'stage' => 'upload',
        'code' => $httpCode
    ]);
    exit();
}

echo json_encode(['success' => true, 'url' => $data['data']['url']]);
?>
