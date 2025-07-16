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
3. 以下のコードを貼り付け：

```javascript
// カレンダーID（「つくまなバイト2」カレンダーのID）
const CALENDAR_ID = 'tukumanalab@gmail.com';

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    
    if (data.type === 'shift') {
      // シフトデータの処理
      const shiftSheet = spreadsheet.getSheetByName('シフト');
      
      if (!shiftSheet) {
        throw new Error('「シフト」シートが見つかりません');
      }
      
      // シフトデータを追加
      shiftSheet.appendRow([
        new Date(),
        data.userId,
        data.userName,
        data.userEmail,
        data.date,
        data.time,
        data.content
      ]);
      
      // Google Calendarに予定を追加
      addToCalendar(data);
      
    } else if (data.type === 'syncAll') {
      // 全シフトデータの同期
      syncAllShiftsToCalendar();
      
    } else {
      // ユーザーログインデータの処理
      const userSheet = spreadsheet.getSheetByName('ユーザー');
      
      if (!userSheet) {
        throw new Error('「ユーザー」シートが見つかりません');
      }
      
      // ユーザーIDが空の場合は追加しない
      if (!data.sub) {
        throw new Error('ユーザーIDが空です');
      }
      
      // 既存のユーザーIDをチェック
      const existingData = userSheet.getDataRange().getValues();
      const existingUserIds = existingData.slice(1).map(row => row[1]); // B列のユーザーID
      
      // ユーザーIDが既に存在する場合は追加しない
      if (existingUserIds.includes(data.sub)) {
        Logger.log('既存のユーザーです: ' + data.sub);
        return ContentService
          .createTextOutput(JSON.stringify({success: true, message: '既存のユーザーです'}))
          .setMimeType(ContentService.MimeType.JSON);
      }
      
      // 新しいユーザーデータを追加
      userSheet.appendRow([
        new Date(),
        data.sub,
        data.name,
        data.email,
        data.picture
      ]);
    }
    
    return ContentService
      .createTextOutput(JSON.stringify({success: true}))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({success: false, error: error.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function addToCalendar(shiftData) {
  try {
    // カレンダーを取得
    const calendar = CalendarApp.getCalendarById(CALENDAR_ID);
    
    if (!calendar) {
      throw new Error('カレンダーが見つかりません: ' + CALENDAR_ID);
    }
    
    // 日付と時間の解析
    const shiftDate = new Date(shiftData.date);
    const timeSlot = parseTimeSlot(shiftData.time);
    
    // 開始時刻と終了時刻を設定
    const startTime = new Date(shiftDate);
    startTime.setHours(timeSlot.startHour, timeSlot.startMinute, 0, 0);
    
    const endTime = new Date(shiftDate);
    endTime.setHours(timeSlot.endHour, timeSlot.endMinute, 0, 0);
    
    // 予定のタイトルと説明
    const title = `${shiftData.userName} - ${shiftData.content}`;
    const description = `担当者: ${shiftData.userName}\n` +
                       `メール: ${shiftData.userEmail}\n` +
                       `時間帯: ${shiftData.time}\n` +
                       `内容: ${shiftData.content}`;
    
    // カレンダーに予定を追加
    calendar.createEvent(title, startTime, endTime, {
      description: description,
      location: '',
      guests: shiftData.userEmail,
      sendInvites: false
    });
    
    Logger.log('カレンダーに予定を追加しました: ' + title);
    
  } catch (error) {
    Logger.log('カレンダーへの追加に失敗しました: ' + error.toString());
    throw error;
  }
}

function parseTimeSlot(timeSlot) {
  const timeSlots = {
    '早朝 (6:00-9:00)': { startHour: 6, startMinute: 0, endHour: 9, endMinute: 0 },
    '午前 (9:00-12:00)': { startHour: 9, startMinute: 0, endHour: 12, endMinute: 0 },
    '午後 (12:00-15:00)': { startHour: 12, startMinute: 0, endHour: 15, endMinute: 0 },
    '夕方 (15:00-18:00)': { startHour: 15, startMinute: 0, endHour: 18, endMinute: 0 },
    '夜間 (18:00-21:00)': { startHour: 18, startMinute: 0, endHour: 21, endMinute: 0 },
    '深夜 (21:00-24:00)': { startHour: 21, startMinute: 0, endHour: 24, endMinute: 0 },
    '終日 (9:00-18:00)': { startHour: 9, startMinute: 0, endHour: 18, endMinute: 0 }
  };
  
  return timeSlots[timeSlot] || { startHour: 9, startMinute: 0, endHour: 18, endMinute: 0 };
}

function syncAllShiftsToCalendar() {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const shiftSheet = spreadsheet.getSheetByName('シフト');
    
    if (!shiftSheet) {
      throw new Error('「シフト」シートが見つかりません');
    }
    
    // カレンダーを取得
    const calendar = CalendarApp.getCalendarById(CALENDAR_ID);
    
    if (!calendar) {
      throw new Error('カレンダーが見つかりません: ' + CALENDAR_ID);
    }
    
    // 既存のカレンダーイベントを削除（重複を防ぐため）
    const now = new Date();
    const futureDate = new Date(now.getTime() + (365 * 24 * 60 * 60 * 1000)); // 1年後まで
    const events = calendar.getEvents(now, futureDate);
    
    // 「つくまなバイト2」関連のイベントを削除
    events.forEach(event => {
      if (event.getTitle().includes(' - ') && event.getDescription().includes('担当者:')) {
        event.deleteEvent();
      }
    });
    
    // シフトデータを取得（ヘッダー行を除く）
    const shiftData = shiftSheet.getDataRange().getValues().slice(1);
    let syncCount = 0;
    
    // 各シフトをカレンダーに追加
    shiftData.forEach(row => {
      if (row.length >= 7) {
        const shiftInfo = {
          userId: row[1],
          userName: row[2],
          userEmail: row[3],
          date: row[4],
          time: row[5],
          content: row[6]
        };
        
        // 日付が有効かチェック
        const shiftDate = new Date(shiftInfo.date);
        if (shiftDate >= now) { // 今日以降の予定のみ同期
          addToCalendar(shiftInfo);
          syncCount++;
        }
      }
    });
    
    Logger.log(`${syncCount}件のシフトをカレンダーに同期しました`);
    
  } catch (error) {
    Logger.log('一括同期に失敗しました: ' + error.toString());
    throw error;
  }
}
```

4. プロジェクトを保存
5. 「デプロイ」→「新しいデプロイ」を選択
6. 種類で「ウェブアプリ」を選択
7. 実行者を「自分」、アクセスできるユーザーを「全員」に設定
8. デプロイして、ウェブアプリのURLをコピー

## 2. アプリケーションの設定

app.jsの`GOOGLE_APPS_SCRIPT_URL`を上記で取得したURLに置き換えてください。

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