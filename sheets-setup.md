# Google Spreadsheet 連携セットアップ

ログイン情報をGoogle Spreadsheetに保存するための設定手順です。

## 1. Google Apps Scriptの設定

### スプレッドシートの作成
1. [Google Sheets](https://sheets.google.com)で新しいスプレッドシートを作成
2. 「ユーザー」シートの設定：
   - シート名を「ユーザー」に変更
   - 以下のヘッダーを1行目に追加：
     - A1: `タイムスタンプ`
     - B1: `ユーザーID` 
     - C1: `名前`
     - D1: `メールアドレス`
     - E1: `プロフィール画像URL`
3. 「シフト」シートの作成：
   - 新しいシートを追加して「シフト」に名前を変更
   - 以下のヘッダーを1行目に追加：
     - A1: `登録日時`
     - B1: `ユーザーID`
     - C1: `ユーザー名`
     - D1: `メールアドレス`
     - E1: `シフト日付`
     - F1: `時間帯`
     - G1: `予定内容`

### Google Apps Scriptの作成
1. スプレッドシートで「拡張機能」→「Apps Script」を選択
2. 新しいプロジェクトを作成
3. プロジェクトに含まれている`google-apps-script.js`ファイルの内容をコピーしてGoogle Apps Scriptエディタに貼り付けてください

4. プロジェクトを保存
5. 「デプロイ」→「新しいデプロイ」を選択
6. 種類で「ウェブアプリ」を選択
7. 実行者を「自分」、アクセスできるユーザーを「全員」に設定
8. デプロイして、ウェブアプリのURLをコピー

## 2. アプリケーションの設定

1. `config.js.example`を`config.js`にコピーしてください
2. `config.js`の`GOOGLE_APPS_SCRIPT_URL`を上記で取得したURLに置き換えてください
3. `config.js`の`GOOGLE_CLIENT_ID`を実際のGoogle Client IDに置き換えてください

**注意**: `config.js`にはシークレットが含まれているため、`.gitignore`に追加されており、Gitにコミットされません。

## 3. Google Calendar連携の設定

### Google Calendar APIの有効化
1. Google Apps Scriptエディタで「サービス」→「+」をクリック
2. 「Google Calendar API」を選択して追加
3. 識別子は「Calendar」のままでOK

### カレンダーIDの確認
1. Google Calendarで「つくまなバイト2」カレンダーを開く
2. 設定から「カレンダーの統合」を選択
3. 「カレンダーID」をコピー（通常は`tukumanalab@gmail.com`形式）

### カレンダー共有設定
1. 「つくまなバイト2」カレンダーの設定を開く
2. 「特定のユーザーとの共有」でGoogle Apps Scriptを実行するアカウントに「予定の変更権限」を付与

## 注意事項

- Google Apps Scriptは無料枠での制限があります
- 大量のログイン履歴がある場合は制限に注意してください
- 本番環境では適切なエラーハンドリングとセキュリティ対策を実装してください
- Google Calendar APIの使用制限に注意してください