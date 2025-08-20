# テスト

このプロジェクトでは Jest を使用してテストを実行します。

## セットアップ

```bash
npm install
```

## テスト実行

```bash
# 全テスト実行
npm test

# テストをウォッチモードで実行
npm run test:watch

# カバレッジレポート付きでテスト実行
npm run test:coverage
```

## テスト構成

### ファイル構成
```
test/
├── setup.js              # Jest セットアップファイル
└── shift-application.test.js  # シフト申請機能のテスト
```

### テスト内容

#### シフト申請機能テスト (`shift-application.test.js`)

1. **単一時間枠のシフト申請**
   - 13:00-13:30の1つの時間枠を申請
   - 正しいリクエストデータが送信されることを確認
   - キャッシュが適切に更新されることを確認

2. **複数時間枠の一括申請**
   - 3つの時間枠を同時に申請
   - 配列形式で時間枠が送信されることを確認
   - 複数のシフトがキャッシュに追加されることを確認

3. **必須フィールドの検証**
   - type, userId, userName, userEmail, date, timeSlots が含まれているか確認
   - データ型が正しいことを確認

4. **エラーハンドリング**
   - fetchエラー時にエラーメッセージが表示されることを確認
   - 適切なエラーログが出力されることを確認

5. **no-corsモードの確認**
   - no-corsモードが正しく設定されていることを確認

6. **データ形式の検証**
   - 日付形式がYYYY-MM-DDであることを確認
   - 時間枠形式がHH:MM-HH:MMであることを確認

### モック

- **fetch**: Google Apps Script APIへのリクエストをモック化
- **DOM要素**: 必要なDOM要素をモック化
- **アラート**: alert, confirm 関数をモック化
- **グローバル変数**: currentUser, myShiftsCache などをモック化

## GitHub Actions

`.github/workflows/test.yml` で以下の環境でテストを実行します：

- Node.js 18.x, 20.x
- Ubuntu 最新版
- カバレッジレポートを Codecov にアップロード

## テストの追加

新しいテストを追加する場合は、`test/` ディレクトリに `*.test.js` ファイルを作成してください。

例：
```javascript
describe('新機能', () => {
  test('正常に動作する', () => {
    // テストコード
    expect(result).toBe(expected);
  });
});
```