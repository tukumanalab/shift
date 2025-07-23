#!/bin/bash

echo "🚀 Google Apps Scriptをデプロイ中..."

# ファイルの存在確認
if [ ! -f "google-apps-script.js" ]; then
    echo "❌ google-apps-script.js が見つかりません"
    exit 1
fi

if [ ! -f ".clasp.json" ]; then
    echo "❌ .clasp.json が見つかりません"
    echo "📖 セットアップが必要です"
    exit 1
fi

# ファイルの確認
echo "📋 ファイルを確認中..."
ls -la google-apps-script.js

# ファイルをプッシュ
echo "📤 ファイルをアップロード中..."
if clasp push --force; then
    echo "✅ ファイルのアップロードが完了しました"
else
    echo "❌ ファイルのアップロードに失敗しました"
    exit 1
fi

# デプロイ
echo "🔄 デプロイ中..."
if clasp deploy --description "$(date '+%Y-%m-%d %H:%M:%S') 自動デプロイ"; then
    echo "✅ デプロイが完了しました"
    echo "🌐 Google Apps Script エディタで確認: clasp open"
else
    echo "❌ デプロイに失敗しました"
    exit 1
fi