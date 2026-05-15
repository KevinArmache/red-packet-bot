# Test workflow Red Packet Bot
# Codes non-BP extraits de @Muhammadtari55 (15-16 May 2026)

$BASE_URL = "http://localhost:3000"

$NON_BP_CODES = @(
    "PFJY6HOV","RHD6AW9","79EF4NNG","0BR6E70Z","ST35MVOK","LCTUC1CJ",
    "HFODK4T1","QEDPV4AZ","Y5CY0FLM","KHLLE2R","QNPQJGJB","2BLIRBY1",
    "EGBFC3UD","9EE035BF","F1MH6598","5LLGAKW1"
)

Write-Host "`n== RED PACKET BOT - TEST COMPLET ==" -ForegroundColor Cyan

# 0 - Verifier serveur
Write-Host "`n[0] Verification serveur $BASE_URL..." -ForegroundColor Yellow
try {
    $r = Invoke-RestMethod "$BASE_URL/api/test?step=env" -TimeoutSec 10
    Write-Host "    OK - API_KEY: $($r.environment.BINANCE_API_KEY)" -ForegroundColor Green
    Write-Host "    Mode test: $($r.environment.BINANCE_TEST_MODE)" -ForegroundColor Gray
} catch {
    Write-Host "    ERREUR serveur: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "    Lancez 'pnpm run dev' dans un autre terminal !" -ForegroundColor Yellow
    exit 1
}

# 1 - Ajouter compte
Write-Host "`n[1] Ajout compte @Muhammadtari55..." -ForegroundColor Yellow
try {
    $body = '{"username":"Muhammadtari55"}'
    $r = Invoke-RestMethod "$BASE_URL/api/add-account" -Method POST -Body $body -ContentType "application/json" -TimeoutSec 10
    Write-Host "    Resultat: $($r | ConvertTo-Json -Compress)" -ForegroundColor Gray
} catch {
    Write-Host "    Info: $($_.Exception.Message)" -ForegroundColor Gray
}

# 2 - Test extraction regex
Write-Host "`n[2] Test extraction regex..." -ForegroundColor Yellow
$tweetText = "Today Red Packet Codes PFJY6HOV RHD6AW9 BPNAANK34X 5LLGAKW1 BPWW78B144"
Write-Host "    Texte test: $tweetText" -ForegroundColor Gray
try {
    $body = "{`"text`":`"$tweetText`",`"author`":`"test`"}"
    $r = Invoke-RestMethod "$BASE_URL/api/ingest-code" -Method POST -Body $body -ContentType "application/json" -TimeoutSec 10
    Write-Host "    Codes detectes: $($r.codesFound), Ajoutes: $($r.codesAdded)" -ForegroundColor Green
    Write-Host "    Added: $($r.added -join ', ')" -ForegroundColor Green
    Write-Host "    Skipped: $($r.skipped -join ', ')" -ForegroundColor Gray
} catch {
    Write-Host "    ERREUR: $($_.Exception.Message)" -ForegroundColor Red
}

# 3 - Injecter les 16 codes non-BP
Write-Host "`n[3] Injection des $($NON_BP_CODES.Count) codes NON-BP..." -ForegroundColor Yellow
$injected = @()
$alreadyExists = @()

foreach ($code in $NON_BP_CODES) {
    try {
        $bodyJson = "{`"code`":`"$code`",`"text`":`"Tweet Muhammadtari55 15-16 May 2026`",`"author`":`"Muhammadtari55`",`"tweetId`":`"tweet-20260515`"}"
        $r = Invoke-RestMethod "$BASE_URL/api/ingest-code" -Method POST -Body $bodyJson -ContentType "application/json" -TimeoutSec 10

        if ($r.success -and $r.id) {
            Write-Host "    OK  $code (id=$($r.id))" -ForegroundColor Green
            $injected += [PSCustomObject]@{ code = $code; id = $r.id }
        } else {
            Write-Host "    -- $code ($($r.error))" -ForegroundColor DarkYellow
            $alreadyExists += $code
        }
    } catch {
        Write-Host "    ERR $code : $($_.Exception.Message)" -ForegroundColor Red
    }
    Start-Sleep -Milliseconds 50
}
Write-Host "    Total injectes: $($injected.Count) | Existants: $($alreadyExists.Count)" -ForegroundColor Cyan

# 4 - Test CLAIM via vrais endpoints Binance (HMAC-SHA256)
Write-Host "`n[4] Test CLAIM API Binance (vrais endpoints)..." -ForegroundColor Yellow

# Lire cles depuis .env
$envLines = Get-Content ".env" -ErrorAction SilentlyContinue
$API_KEY = ""
$SECRET_KEY = ""
foreach ($line in $envLines) {
    if ($line -match "^BINANCE_API_KEY=(.+)") { $API_KEY = $Matches[1].Trim() }
    if ($line -match "^BINANCE_SECRET_KEY=(.+)") { $SECRET_KEY = $Matches[1].Trim() }
}

if (-not $API_KEY -or -not $SECRET_KEY) {
    Write-Host "    ERREUR: Cles Binance non trouvees dans .env" -ForegroundColor Red
} else {
    Write-Host "    API_KEY configure: $($API_KEY.Substring(0,8))..." -ForegroundColor Gray

    function Get-HmacSha256 {
        param($message, $secret)
        $hmac = New-Object System.Security.Cryptography.HMACSHA256
        $hmac.Key = [System.Text.Encoding]::UTF8.GetBytes($secret)
        $bytes = $hmac.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($message))
        return ($bytes | ForEach-Object { $_.ToString("x2") }) -join ""
    }

    $codesToClaim = if ($injected.Count -gt 0) { $injected | Select-Object -First 5 -ExpandProperty code } else { $NON_BP_CODES | Select-Object -First 5 }

    foreach ($code in $codesToClaim) {
        $ts = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        $qs = "code=$code" + "&" + "timestamp=$ts"
        $sig = Get-HmacSha256 $qs $SECRET_KEY
        $fullBody = $qs + "&" + "signature=$sig"

        Write-Host "    -> Claim: $code" -ForegroundColor Yellow
        try {
            $r = Invoke-RestMethod `
                -Uri "https://api.binance.com/sapi/v1/giftcard/redeemCode" `
                -Method POST `
                -Headers @{ "X-MBX-APIKEY" = $API_KEY } `
                -Body $fullBody `
                -ContentType "application/x-www-form-urlencoded" `
                -TimeoutSec 15

            Write-Host "       SUCCESS: token=$($r.data.token) amount=$($r.data.amount) ref=$($r.data.referenceNo)" -ForegroundColor Green
        } catch {
            $errMsg = ""
            if ($_.Exception.Response) {
                try {
                    $stream = $_.Exception.Response.GetResponseStream()
                    $reader = New-Object System.IO.StreamReader($stream)
                    $errMsg = $reader.ReadToEnd()
                } catch {}
            }
            if (-not $errMsg) { $errMsg = $_.Exception.Message }
            Write-Host "       FAIL: $errMsg" -ForegroundColor Red
        }
        Start-Sleep -Milliseconds 300
    }
}

# 5 - Test cron job
Write-Host "`n[5] Test cron job /api/scrape..." -ForegroundColor Yellow
try {
    $r = Invoke-RestMethod "$BASE_URL/api/scrape" -Headers @{ "Authorization" = "Bearer my-cron-secret-2026" } -TimeoutSec 30
    Write-Host "    OK: codes=$($r.codesFound) comptes=$($r.accountsScraped) erreurs=$($r.errors.Count)" -ForegroundColor Green
} catch {
    $errMsg = ""
    if ($_.Exception.Response) {
        try {
            $stream = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($stream)
            $errMsg = $reader.ReadToEnd()
        } catch {}
    }
    if (-not $errMsg) { $errMsg = $_.Exception.Message }
    Write-Host "    Reponse cron: $errMsg" -ForegroundColor Gray
}

# 6 - Dashboard final
Write-Host "`n[6] Etat final de la base de donnees..." -ForegroundColor Yellow
try {
    $r = Invoke-RestMethod "$BASE_URL/api/test?step=db" -TimeoutSec 10
    Write-Host "    Total codes en DB: $($r.database.totalCodes)" -ForegroundColor Cyan
} catch {
    Write-Host "    ERREUR: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n== TEST TERMINE ==" -ForegroundColor Cyan
Write-Host "Ouvrez http://localhost:3000 pour voir les codes dans le dashboard`n" -ForegroundColor White
