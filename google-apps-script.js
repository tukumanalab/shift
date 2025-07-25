// Google Apps Script用のJavaScriptコード
// このファイルをGoogle Apps Scriptエディタにコピー&ペーストしてください

// カレンダーID（「つくまなバイト2」カレンダーのID）
const CALENDAR_ID = 'tukumanalab@gmail.com';

function doGet(e) {
  try {
    const params = e.parameter;
    
    if (params.type === 'loadCapacity') {
      // 人数設定データの読み込み
      const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
      const capacityData = loadCapacitySettings(spreadsheet);
      
      return ContentService
        .createTextOutput(JSON.stringify({success: true, data: capacityData}))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService
      .createTextOutput(JSON.stringify({success: false, error: 'Invalid request'}))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({success: false, error: error.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

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
      
    } else if (data.type === 'capacity') {
      // 人数設定データの処理
      saveCapacitySettings(spreadsheet, data.data);
      
    } else if (data.type === 'loadCapacity') {
      // 人数設定データの読み込み
      const capacityData = loadCapacitySettings(spreadsheet);
      return ContentService
        .createTextOutput(JSON.stringify({success: true, data: capacityData}))
        .setMimeType(ContentService.MimeType.JSON);
        
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

function loadCapacitySettings(spreadsheet) {
  try {
    // 「人数設定」シートを取得
    const capacitySheet = spreadsheet.getSheetByName('人数設定');
    
    if (!capacitySheet) {
      Logger.log('「人数設定」シートが見つかりません');
      return [];
    }
    
    // データを取得（ヘッダー行を除く）
    const data = capacitySheet.getDataRange().getValues();
    
    if (data.length <= 1) {
      Logger.log('人数設定データがありません');
      return [];
    }
    
    // データを変換して返す
    const capacityData = data.slice(1).map(row => {
      let dateStr = '';
      try {
        // 日付の形式を統一
        const dateValue = row[1];
        if (dateValue instanceof Date) {
          dateStr = Utilities.formatDate(dateValue, Session.getScriptTimeZone(), 'yyyy-MM-dd');
        } else if (typeof dateValue === 'string') {
          // 文字列の場合はそのまま使用（YYYY-MM-DD形式を想定）
          dateStr = dateValue;
        } else {
          // その他の場合は空文字列
          dateStr = '';
        }
      } catch (e) {
        dateStr = '';
      }
      
      return {
        date: dateStr,
        capacity: parseInt(row[2]) || 0
      };
    }).filter(item => item.date !== ''); // 有効な日付のみ
    
    Logger.log(`${capacityData.length}件の人数設定を読み込みました`);
    return capacityData;
    
  } catch (error) {
    Logger.log('人数設定の読み込みに失敗しました: ' + error.toString());
    return [];
  }
}

function saveCapacitySettings(spreadsheet, capacityData) {
  try {
    // 「人数設定」シートを取得または作成
    let capacitySheet = spreadsheet.getSheetByName('人数設定');
    
    if (!capacitySheet) {
      // シートが存在しない場合は作成して初期化
      capacitySheet = spreadsheet.insertSheet('人数設定');
      
      // ヘッダー行を追加
      capacitySheet.appendRow([
        '更新日時',
        '日付',
        '必要人数',
        '更新者ID',
        '更新者名'
      ]);
      
      // 年度末までの全日付のデータを初期化
      initializeCapacityData(capacitySheet);
    }
    
    // 既存のデータから更新対象の日付のみ更新
    updateCapacityData(capacitySheet, capacityData);
    
    Logger.log(`${capacityData.length}件の人数設定を保存しました`);
    
  } catch (error) {
    Logger.log('人数設定の保存に失敗しました: ' + error.toString());
    throw error;
  }
}

function initializeCapacityData(capacitySheet) {
  try {
    const today = new Date();
    const currentYear = today.getFullYear();
    const nextYear = currentYear + 1;
    
    // 現在の月から来年度末（3月31日）まで
    let startDate = new Date(currentYear, today.getMonth(), 1);
    let endDate = new Date(nextYear, 3, 0); // 3月31日
    
    // もし現在が4月以降なら、今年度末まで
    if (today.getMonth() >= 3) {
      endDate = new Date(currentYear + 1, 3, 0);
    }
    
    const initData = [];
    let currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const dateStr = Utilities.formatDate(currentDate, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      const dayOfWeek = currentDate.getDay();
      
      // デフォルトの人数を設定（日曜日=0, 月曜日=1, 火曜日=2, 水曜日=3, 木曜日=4, 金曜日=5, 土曜日=6）
      let defaultCapacity;
      switch (dayOfWeek) {
        case 0: // 日曜日
        case 6: // 土曜日
          defaultCapacity = 0;
          break;
        case 3: // 水曜日
          defaultCapacity = 2;
          break;
        default: // 月火木金
          defaultCapacity = 3;
          break;
      }
      
      initData.push([
        new Date(),
        dateStr,
        defaultCapacity,
        'system',
        'システム初期化'
      ]);
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // 一括でデータを追加
    if (initData.length > 0) {
      capacitySheet.getRange(2, 1, initData.length, 5).setValues(initData);
      Logger.log(`${initData.length}件の人数設定を初期化しました`);
    }
    
  } catch (error) {
    Logger.log('人数設定の初期化に失敗しました: ' + error.toString());
    throw error;
  }
}

function updateCapacityData(capacitySheet, capacityData) {
  try {
    // 既存のデータを取得
    const existingData = capacitySheet.getDataRange().getValues();
    const headerRow = existingData[0];
    const dataRows = existingData.slice(1);
    
    // 日付をキーとするマップを作成
    const dateRowMap = {};
    dataRows.forEach((row, index) => {
      const dateValue = row[1];
      let dateStr = '';
      
      if (dateValue instanceof Date) {
        dateStr = Utilities.formatDate(dateValue, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      } else if (typeof dateValue === 'string') {
        dateStr = dateValue;
      }
      
      if (dateStr) {
        dateRowMap[dateStr] = index + 2; // シートの行番号（1ベース、ヘッダー分+1）
      }
    });
    
    // 各データを更新
    capacityData.forEach(item => {
      const rowNumber = dateRowMap[item.date];
      if (rowNumber) {
        // 既存の行を更新
        capacitySheet.getRange(rowNumber, 1, 1, 5).setValues([[
          new Date(item.timestamp),
          item.date,
          item.capacity,
          item.userId,
          item.userName
        ]]);
      } else {
        // 新しい日付の場合は追加
        capacitySheet.appendRow([
          new Date(item.timestamp),
          item.date,
          item.capacity,
          item.userId,
          item.userName
        ]);
      }
    });
    
  } catch (error) {
    Logger.log('人数設定の更新に失敗しました: ' + error.toString());
    throw error;
  }
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