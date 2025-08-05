# 测试提交脚本 - 模拟完整的提交前检查 (Windows PowerShell)
# 使用方法: .\scripts\test-commit.ps1

param()

$ErrorActionPreference = "Stop"

Write-Host "🔍 开始模拟提交前检查..." -ForegroundColor Cyan

function Test-Step {
    param($StepName, $ExitCode)
    if ($ExitCode -eq 0) {
        Write-Host "✅ $StepName 通过" -ForegroundColor Green
    } else {
        Write-Host "❌ $StepName 失败" -ForegroundColor Red
        exit 1
    }
}

try {
    Write-Host "📝 1. 运行类型检查..." -ForegroundColor Yellow
    pnpm type-check
    Test-Step "类型检查" $LASTEXITCODE

    Write-Host "🧹 2. 运行代码风格检查..." -ForegroundColor Yellow
    pnpm lint
    Test-Step "代码风格检查" $LASTEXITCODE

    Write-Host "🧪 3. 运行所有测试..." -ForegroundColor Yellow
    pnpm test:run
    Test-Step "测试执行" $LASTEXITCODE

    Write-Host "📊 4. 检查测试覆盖率..." -ForegroundColor Yellow
    pnpm test:coverage
    Test-Step "测试覆盖率" $LASTEXITCODE

    Write-Host "🎉 所有检查通过！可以安全提交代码。" -ForegroundColor Green
}
catch {
    Write-Host "💥 检查过程中出现错误: $_" -ForegroundColor Red
    exit 1
}