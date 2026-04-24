#!/bin/bash
# ============================================================
# KidsSafe AI Platform — GitHub Push Script
# Repository: https://github.com/AlessioAka/kidssafe-ai-platform
#
# Usage:
#   1. Get a Personal Access Token from:
#      https://github.com/settings/tokens/new
#      (select 'repo' scope, any expiry)
#   2. Run:
#      bash PUSH_TO_GITHUB.sh
# ============================================================

echo ""
echo "========================================="
echo "  KidsSafe — Push to GitHub"
echo "  AlessioAka/kidssafe-ai-platform"
echo "========================================="
echo ""

read -s -p "Paste your GitHub Personal Access Token and press Enter: " TOKEN
echo ""

if [ -z "$TOKEN" ]; then
  echo "Error: Token is required."
  exit 1
fi

echo "Pushing to GitHub..."

git remote set-url origin "https://${TOKEN}@github.com/AlessioAka/kidssafe-ai-platform.git"
git push -u origin main

if [ $? -eq 0 ]; then
  # Remove token from remote URL after successful push (security)
  git remote set-url origin "https://github.com/AlessioAka/kidssafe-ai-platform.git"
  echo ""
  echo "========================================="
  echo "  SUCCESS! Code is live at:"
  echo "  https://github.com/AlessioAka/kidssafe-ai-platform"
  echo "========================================="
else
  git remote set-url origin "https://github.com/AlessioAka/kidssafe-ai-platform.git"
  echo ""
  echo "Push failed. Check your token has 'repo' scope."
  echo "Create a new token at: https://github.com/settings/tokens/new"
fi
