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

$imageData = file_get_contents($imageUrl);
if ($imageData === false) {
    http_response_code(400);
    echo json_encode(['error' => 'Failed to download image from URL: ' . $imageUrl]);
    exit();
}

$finfo = new finfo(FILEINFO_MIME_TYPE);
$mimeType = $finfo->buffer($imageData);
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
    echo json_encode(['error' => 'Curl error: ' . $curlError]);
    exit();
}

if ($httpCode !== 200) {
    http_response_code($httpCode);
    echo json_encode(['error' => 'ImgBB API error', 'code' => $httpCode, 'response' => $response]);
    exit();
}

$data = json_decode($response, true);
if (isset($data['data']['url'])) {
    echo json_encode(['success' => true, 'url' => $data['data']['url']]);
} else {
    http_response_code(500);
    echo json_encode(['error' => 'Invalid response from ImgBB', 'response' => $data]);
}
?>
