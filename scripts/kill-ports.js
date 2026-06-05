const { execSync } = require('child_process')

for (const port of ['5173', '8000']) {
  try {
    execSync(
      `for /f "tokens=5" %a in ('netstat -ano ^| findstr :${port} ^| findstr LISTENING') do taskkill /f /pid %a`,
      { shell: 'cmd.exe', stdio: 'ignore' }
    )
  } catch (_) {}
}
