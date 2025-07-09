#!/bin/bash

# テストユーザーを作成するスクリプト
# Supabase API経由でユーザーを作成し、その後usersテーブルに情報を追加

# Supabaseの設定
SUPABASE_URL="http://127.0.0.1:54321"
SUPABASE_SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"

echo "🚀 テストユーザーの作成を開始..."

# 1. 管理者ユーザーを作成
echo "👑 管理者ユーザーを作成中..."
ADMIN_RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/auth/v1/admin/users" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "password",
    "user_metadata": {
      "name": "管理者ユーザー"
    },
    "email_confirm": true
  }')

ADMIN_ID=$(echo $ADMIN_RESPONSE | jq -r '.id')
echo "✅ 管理者ユーザー作成完了: $ADMIN_ID"

# 2. 一般ユーザー1を作成
echo "👤 一般ユーザー1を作成中..."
USER1_RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/auth/v1/admin/users" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user1@example.com",
    "password": "password",
    "user_metadata": {
      "name": "田中太郎"
    },
    "email_confirm": true
  }')

USER1_ID=$(echo $USER1_RESPONSE | jq -r '.id')
echo "✅ 一般ユーザー1作成完了: $USER1_ID"

# 3. 一般ユーザー2を作成
echo "👤 一般ユーザー2を作成中..."
USER2_RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/auth/v1/admin/users" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user2@example.com",
    "password": "password",
    "user_metadata": {
      "name": "佐藤花子"
    },
    "email_confirm": true
  }')

USER2_ID=$(echo $USER2_RESPONSE | jq -r '.id')
echo "✅ 一般ユーザー2作成完了: $USER2_ID"

# 4. public.usersテーブルに情報を追加
echo "📊 usersテーブルに情報を追加中..."

# 各ユーザーを個別に追加
curl -s -X POST "${SUPABASE_URL}/rest/v1/users" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"id\": \"$ADMIN_ID\", \"name\": \"管理者ユーザー\", \"is_admin\": true}"

curl -s -X POST "${SUPABASE_URL}/rest/v1/users" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"id\": \"$USER1_ID\", \"name\": \"田中太郎\", \"is_admin\": false}"

curl -s -X POST "${SUPABASE_URL}/rest/v1/users" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"id\": \"$USER2_ID\", \"name\": \"佐藤花子\", \"is_admin\": false}"

# 5. サンプルシフトデータを追加
echo "📅 サンプルシフトデータを追加中..."

# 各シフトを個別に追加
curl -s -X POST "${SUPABASE_URL}/rest/v1/shifts" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"user_id\": \"$USER1_ID\", \"date\": \"2025-01-15\", \"time_slot\": \"13:00-14:00\", \"note\": \"午後からお願いします\", \"status\": \"pending\"}"

curl -s -X POST "${SUPABASE_URL}/rest/v1/shifts" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"user_id\": \"$USER1_ID\", \"date\": \"2025-01-15\", \"time_slot\": \"14:00-15:00\", \"note\": \"\", \"status\": \"approved\"}"

curl -s -X POST "${SUPABASE_URL}/rest/v1/shifts" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"user_id\": \"$USER2_ID\", \"date\": \"2025-01-15\", \"time_slot\": \"16:00-17:00\", \"note\": \"遅刻の可能性があります\", \"status\": \"pending\"}"

curl -s -X POST "${SUPABASE_URL}/rest/v1/shifts" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"user_id\": \"$USER2_ID\", \"date\": \"2025-01-16\", \"time_slot\": \"13:00-14:00\", \"note\": \"\", \"status\": \"approved\"}"

echo ""
echo "🎉 テストユーザーとサンプルデータの作成が完了しました！"
echo ""
echo "📋 作成されたアカウント（パスワード: password）:"
echo "   👑 admin@example.com - 管理者ユーザー"
echo "   👤 user1@example.com - 田中太郎"
echo "   👤 user2@example.com - 佐藤花子"
echo ""
echo "🚀 アプリにログインしてテストしてください！"