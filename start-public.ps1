# 本机起一个临时公网地址：给朋友看、手机上试扫都够用。
# 关掉这个窗口，地址就失效；想长期用就走 README 里的部署方案。
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$cf = Join-Path $root '_parts\cloudflared.exe'

if (-not (Test-Path $cf)) {
    Write-Host '第一次用，先下载 cloudflared（约 50MB）…' -ForegroundColor Yellow
    New-Item -ItemType Directory -Force -Path (Join-Path $root '_parts') | Out-Null
    Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile $cf -UseBasicParsing
}

Write-Host '启动本地服务 http://127.0.0.1:8788 …' -ForegroundColor Green
$server = Start-Process -PassThru -WindowStyle Hidden python -ArgumentList @('-m','http.server','8788','--bind','127.0.0.1','--directory',$root)
Start-Sleep -Seconds 2

try {
    Write-Host '建立公网隧道，下面会出现一个 https://xxx.trycloudflare.com 的地址：' -ForegroundColor Green
    & $cf tunnel --url http://127.0.0.1:8788 --no-autoupdate
}
finally {
    if ($server -and -not $server.HasExited) { Stop-Process -Id $server.Id -Force }
    Write-Host '隧道已关闭。' -ForegroundColor Yellow
}
