# Google ログインアプリ

簡単なGoogleログイン機能を持つJavaScriptアプリケーションです。

## セットアップ手順

### 1. Google Cloud Consoleでの設定

1. [Google Cloud Console](https://console.cloud.google.com/)にアクセス
2. 新しいプロジェクトを作成または既存のプロジェクトを選択
3. 「APIとサービス」→「認証情報」に移動
4. 「認証情報を作成」→「OAuth 2.0 クライアントID」を選択
5. アプリケーションの種類で「ウェブアプリケーション」を選択
6. 承認済みのJavaScript生成元に以下を追加：
   - `http://localhost:3000`
   - `http://127.0.0.1:3000`
   - その他必要なドメイン
7. クライアントIDをコピー

### 2. アプリケーションの設定

1. `index.html`と`app.js`の`YOUR_GOOGLE_CLIENT_ID`を取得したクライアントIDに置き換え

### 3. アプリケーションの実行

ローカルサーバーを起動してテスト：

```bash
# Python 3の場合
python -m http.server 3000

# Node.jsの場合（npx serve をインストール済みの場合）
npx serve -p 3000

# PHP（インストール済みの場合）
php -S localhost:3000
```

ブラウザで `http://localhost:3000` にアクセス

## 機能

- Googleアカウントでのログイン
- ユーザープロフィール表示（名前、メール、プロフィール画像）
- ログアウト機能

## 使用技術

- HTML5
- CSS3
- JavaScript
- Google Identity Services (GSI)

## 注意事項

- HTTPSまたはlocalhostでのみ動作します
- 本番環境では適切なセキュリティ対策を実装してください