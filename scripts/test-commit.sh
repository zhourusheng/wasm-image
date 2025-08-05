#!/bin/bash

# 测试提交脚本 - 模拟完整的提交前检查
# 使用方法: ./scripts/test-commit.sh

set -e  # 遇到错误立即退出

echo "🔍 开始模拟提交前检查..."

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查函数
check_step() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ $1 通过${NC}"
    else
        echo -e "${RED}❌ $1 失败${NC}"
        exit 1
    fi
}

echo -e "${YELLOW}📝 1. 运行类型检查...${NC}"
pnpm type-check
check_step "类型检查"

echo -e "${YELLOW}🧹 2. 运行代码风格检查...${NC}"
pnpm lint
check_step "代码风格检查"

echo -e "${YELLOW}🧪 3. 运行所有测试...${NC}"
pnpm test:run
check_step "测试执行"

echo -e "${YELLOW}📊 4. 检查测试覆盖率...${NC}"
pnpm test:coverage
check_step "测试覆盖率"

echo -e "${GREEN}🎉 所有检查通过！可以安全提交代码。${NC}"