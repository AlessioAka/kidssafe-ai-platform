#!/bin/bash
# ============================================================
# KidsSafe AI Platform — GitHub Setup Script
# Run this script once to create the GitHub repo and push.
#
# Usage:
#   chmod +x PUSH_TO_GITHUB.sh
#   ./PUSH_TO_GITHUB.sh
# ============================================================

echo ""
echo "========================================="
echo "  KidsSafe — GitHub Push Setup"
echo "========================================="
echo ""

# Ask for GitHub username
read -p "Enter your GitHub username (e.g. alessioakabuogu): " GITHUB_USERNAME

if [ -z "$GITHUB_USERNAME" ]; then
  echo "Error: GitHub username is required."
  exit 1
fi

REPO_NAME="kidssafe-ai"
echo ""
echo "Steps to complete:"
echo ""
echo "1. Go to https://github.com/new in your browser"
echo "   - Repository name: $REPO_NAME"
echo "   - Description: KidsSafe AI Platform — CMS22204"
echo "   - Set to Public"
echo "   - DO NOT tick 'Add a README file'"
echo "   - Click 'Create repository'"
echo ""
echo "2. Come back here and press ENTER to continue..."
read -p ""

echo ""
echo "3. Adding GitHub remote and pushing..."

git remote add origin "https://github.com/$GITHUB_USERNAME/$REPO_NAME.git"
git branch -M main
git push -u origin main

if [ $? -eq 0 ]; then
  echo ""
  echo "========================================="
  echo "  SUCCESS!"
  echo "  Your code is live at:"
  echo "  https://github.com/$GITHUB_USERNAME/$REPO_NAME"
  echo "========================================="
else
  echo ""
  echo "Push failed. GitHub will ask for your username and a Personal Access Token."
  echo "To create a token: https://github.com/settings/tokens/new"
  echo "Select 'repo' scope and use the token as your password."
fi
