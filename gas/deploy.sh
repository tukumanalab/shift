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

# 既存のデプロイメント一覧を取得
echo "🔄 デプロイ中..."
DEPLOYMENTS=$(clasp deployments 2>/dev/null)

if echo "$DEPLOYMENTS" | grep -q "deploymentId"; then
    # 既存のデプロイメントがある場合は更新
    DEPLOYMENT_ID=$(echo "$DEPLOYMENTS" | grep "deploymentId" | head -1 | awk '{print $2}')
    if [ -n "$DEPLOYMENT_ID" ]; then
        echo "📝 既存のデプロイメントを更新中... (ID: $DEPLOYMENT_ID)"
        if clasp deploy --deploymentId "$DEPLOYMENT_ID" --description "$(date '+%Y-%m-%d %H:%M:%S') 自動更新"; then
            echo "✅ デプロイの更新が完了しました"
        else
            echo "❌ デプロイの更新に失敗しました"
            exit 1
        fi
    else
        echo "❌ デプロイメントIDの取得に失敗しました"
        exit 1
    fi
else
    # 新規デプロイメント
    echo "🆕 新規デプロイメントを作成中..."
    if clasp deploy --description "$(date '+%Y-%m-%d %H:%M:%S') 初回デプロイ"; then
        echo "✅ 新規デプロイが完了しました"
    else
        echo "❌ 新規デプロイに失敗しました"
        exit 1
    fi
fi

echo "🌐 Google Apps Script エディタで確認: clasp open"