param(
    [ValidateSet('running', 'stopped')]
    [string]$StatusCode = 'stopped',
    [string]$ServerPid = ''
)

$utf8 = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = $utf8
$OutputEncoding = $utf8

$statusText = if ($StatusCode -eq 'running' -and $ServerPid) {
    "运行中 PID=$ServerPid"
} elseif ($StatusCode -eq 'running') {
    '运行中'
} else {
    '已停止'
}

Write-Host ''
Write-Host '  ============================================'
Write-Host '    claudeOne - 控制面板'
Write-Host "    服务状态：$statusText"
Write-Host '  ============================================'
Write-Host ''
Write-Host '    [1] 启动服务 + 扫描音乐 + 打开浏览器'
Write-Host '    [2] 仅启动服务'
Write-Host '    [3] 仅扫描音乐 + 更新播放列表'
Write-Host '    [4] 重启服务'
Write-Host '    [5] 停止服务'
Write-Host '    [0] 退出'
Write-Host ''
Write-Host -NoNewline '   请选择: '
