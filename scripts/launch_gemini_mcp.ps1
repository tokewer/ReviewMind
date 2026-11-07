param(
    [int]$Port = 8080
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir
$ToolsDir = Join-Path $RootDir "tools"
$CloudflaredExe = Join-Path $ToolsDir "cloudflared.exe"

Write-Host "========================================================================" -ForegroundColor Cyan
Write-Host "🚀 正在启动 ReviewMind 思维导图 Gemini MCP 专属远程连接服务..." -ForegroundColor Cyan
Write-Host "========================================================================" -ForegroundColor Cyan

# 1. 检查本地 Python server 是否已在运行，未运行则在后台启动
$serverRunning = $false
try {
    $resp = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/api/storage" -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
    if ($resp.StatusCode -eq 200) {
        $serverRunning = $true
        Write-Host "✅ 检测到本地思维导图服务已在运行 (http://127.0.0.1:$Port)" -ForegroundColor Green
    }
} catch {}

if (-not $serverRunning) {
    Write-Host "⏳ 正在启动本地思维导图核心服务 (server.py)..." -ForegroundColor Yellow
    Start-Process -FilePath "python" -ArgumentList "server.py --port=$Port" -WorkingDirectory $RootDir -WindowStyle Hidden
    Start-Sleep -Seconds 2
}

# 2. 检查 cloudflared.exe 是否就绪，若缺失则自动下载
if (-not (Test-Path $CloudflaredExe)) {
    if (-not (Test-Path $ToolsDir)) {
        New-Item -ItemType Directory -Path $ToolsDir -Force | Out-Null
    }
    Write-Host "⏳ 首次启动：正在下载 Cloudflare 官方免费安全隧道组件 (约 50MB)..." -ForegroundColor Yellow
    $downloadUrl = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri $downloadUrl -OutFile $CloudflaredExe -UseBasicParsing
    Write-Host "✅ 隧道组件下载完成！" -ForegroundColor Green
}

# 3. 启动隧道并获取专属 trycloudflare.com 链接
Write-Host "⏳ 正在建立 HTTPS 专属安全通道..." -ForegroundColor Yellow

$procInfo = New-Object System.Diagnostics.ProcessStartInfo
$procInfo.FileName = $CloudflaredExe
$procInfo.Arguments = "tunnel --url http://127.0.0.1:$Port"
$procInfo.RedirectStandardError = $true
$procInfo.RedirectStandardOutput = $true
$procInfo.UseShellExecute = $false
$procInfo.CreateNoWindow = $true

$proc = New-Object System.Diagnostics.Process
$proc.StartInfo = $procInfo
$proc.Start() | Out-Null

$tunnelUrl = ""
$startTime = Get-Date

while ((-not $tunnelUrl) -and ((Get-Date) - $startTime).TotalSeconds -lt 30) {
    if (-not $proc.StandardError.EndOfStream) {
        $line = $proc.StandardError.ReadLine()
        if ($line -match "https://[a-zA-Z0-9\-]+\.trycloudflare\.com") {
            $tunnelUrl = $Matches[0]
            break
        }
    }
    Start-Sleep -Milliseconds 200
}

if (-not $tunnelUrl) {
    Write-Host "❌ 获取隧道链接超时，请检查网络连接。" -ForegroundColor Red
    exit 1
}

$mcpUrl = "$tunnelUrl/mcp"

# 自动复制到剪贴板
try {
    Set-Clipboard -Value $mcpUrl
    $copied = $true
} catch {
    $copied = $false
}

Write-Host ""
Write-Host "========================================================================" -ForegroundColor Green
Write-Host "🎉 专属安全通道建立成功！MCP 服务已实时打通！" -ForegroundColor Green
Write-Host "========================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "👉 您的专属 MCP 服务器网址 (直接填入 Gemini)：" -ForegroundColor Yellow
Write-Host "   $mcpUrl" -ForegroundColor Cyan
Write-Host ""
if ($copied) {
    Write-Host "📋 【已自动复制到剪贴板】！直接在 Gemini 弹窗中按 Ctrl+V 粘贴即可！" -ForegroundColor Green
} else {
    Write-Host "请复制上面的网址，粘贴到 Gemini 弹窗中！" -ForegroundColor Yellow
}
Write-Host ""
Write-Host "💡 提示：" -ForegroundColor Gray
Write-Host "  1. Gemini 弹窗中的「客户端 ID」和「客户端密钥」请直接留空不用填！" -ForegroundColor Gray
Write-Host "  2. 点击「下一步」完成关联后，在 Gemini 中直接对它说话即可调取您的最新导图！" -ForegroundColor Gray
Write-Host "  3. 保持本窗口开启以保持通道畅通，按 Ctrl+C 可随时安全关闭通道。" -ForegroundColor Gray
Write-Host "========================================================================" -ForegroundColor Green

# 阻塞保持运行
try {
    while (-not $proc.HasExited) {
        Start-Sleep -Seconds 1
    }
} finally {
    if (-not $proc.HasExited) {
        $proc.Kill()
    }
}
