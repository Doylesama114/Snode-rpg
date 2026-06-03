#!/bin/bash
# upload-gitee-exe.sh — 手动上传 exe 到 Gitee 发行版
# 用法: ./upload-gitee-exe.sh v1.0.565
# 前提: 已设置 GITEE_TOKEN 环境变量

set -e
TAG="${1:?请指定版本号，如: v1.0.565}"
TOKEN="${GITEE_TOKEN:?请设置 GITEE_TOKEN 环境变量}"
API="https://gitee.com/api/v5/repos/Doylesama007/Snode-rpg/releases"

echo "=== 手动上传 exe 到 Gitee: $TAG ==="

# 1. 获取 Release ID
REL_ID=$(curl -sf "$API?access_token=$TOKEN&per_page=20" | jq -r ".[] | select(.tag_name==\"$TAG\") | .id" | head -1)
if [ -z "$REL_ID" ] || [ "$REL_ID" = "null" ]; then
  echo "ERROR: Release $TAG 不存在，请等待 CI 创建后再运行"
  exit 1
fi
echo "Release ID: $REL_ID"

# 2. 下载 exe（从 GitHub Release）
EXE="Snode-RPG-Setup-${TAG#v}.exe"
GITHUB_URL="https://github.com/Doylesama114/Snode-rpg/releases/download/$TAG/$EXE"
echo "下载: $GITHUB_URL"
curl -L -o "$EXE" "$GITHUB_URL"
echo "文件大小: $(du -h "$EXE" | cut -f1)"

# 3. 上传到 Gitee
echo "上传到 Gitee..."
curl -f --max-time 600 \
  -X POST "$API/$REL_ID/attach_files" \
  -F "access_token=$TOKEN" \
  -F "file=@$EXE"
echo ""
echo "✅ 上传完成!"
echo "Gitee: https://gitee.com/Doylesama007/Snode-rpg/releases/tag/$TAG"

# 4. 同样上传 latest.yml
LATEST_URL="https://github.com/Doylesama114/Snode-rpg/releases/download/$TAG/latest.yml"
echo "下载 latest.yml..."
curl -L -o "latest.yml" "$LATEST_URL"
echo "上传 latest.yml..."
curl -f --max-time 60 \
  -X POST "$API/$REL_ID/attach_files" \
  -F "access_token=$TOKEN" \
  -F "file=@latest.yml"
echo "✅ latest.yml 上传完成"

rm -f "$EXE" latest.yml
