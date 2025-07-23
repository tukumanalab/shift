// Google Apps Script用のJavaScriptコード
// このファイルをGoogle Apps Scriptエディタにコピー&ペーストしてください

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
        
    } else if (params.type === 'loadMyShifts' && params.userId) {
      // ユーザーのシフトデータの読み込み
      const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
      const shiftsData = loadUserShifts(spreadsheet, params.userId);
      
      return ContentService
        .createTextOutput(JSON.stringify({success: true, data: shiftsData}))
        .setMimeType(ContentService.MimeType.JSON);
        
    } else if (params.type === 'loadShiftCounts') {
      // シフト申請数の読み込み
      const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
      const shiftCounts = loadShiftCounts(spreadsheet);
      
      // デバッグ: doGetでのデータ確認
      Logger.log('doGet内でのshiftCounts:', JSON.stringify(shiftCounts));
      if (shiftCounts['2025-07-23']) {
        Logger.log('doGet内での2025-07-23:', typeof shiftCounts['2025-07-23'], JSON.stringify(shiftCounts['2025-07-23']));
      }
      
      const result = {success: true, data: shiftCounts};
      Logger.log('最終的に返すJSON:', JSON.stringify(result));
      
      return ContentService
        .createTextOutput(JSON.stringify(result))
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
      const shiftSheet = spreadsheet.getSheetByName(GAS_CONFIG.SHEET_NAMES.SHIFTS);
      
      if (!shiftSheet) {
        throw new Error(`「${GAS_CONFIG.SHEET_NAMES.SHIFTS}」シートが見つかりません`);
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
      
    } else if (data.type === 'saveUser') {
      // ユーザーログインデータの処理
      saveUserData(spreadsheet, data);
      
    } else {
      throw new Error('不明なリクエストタイプ: ' + data.type);
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
    const calendar = CalendarApp.getCalendarById(GAS_CONFIG.CALENDAR_ID);
    
    if (!calendar) {
      throw new Error('カレンダーが見つかりません: ' + GAS_CONFIG.CALENDAR_ID);
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
    const capacitySheet = spreadsheet.getSheetByName(GAS_CONFIG.SHEET_NAMES.CAPACITY);
    
    if (!capacitySheet) {
      Logger.log(`「${GAS_CONFIG.SHEET_NAMES.CAPACITY}」シートが見つかりません`);
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
    let capacitySheet = spreadsheet.getSheetByName(GAS_CONFIG.SHEET_NAMES.CAPACITY);
    
    if (!capacitySheet) {
      // シートが存在しない場合は作成して初期化
      capacitySheet = spreadsheet.insertSheet(GAS_CONFIG.SHEET_NAMES.CAPACITY);
      
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
          defaultCapacity = GAS_CONFIG.DEFAULT_CAPACITY.WEEKEND;
          break;
        case 3: // 水曜日
          defaultCapacity = GAS_CONFIG.DEFAULT_CAPACITY.WEDNESDAY;
          break;
        default: // 月火木金
          defaultCapacity = GAS_CONFIG.DEFAULT_CAPACITY.WEEKDAY;
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

function saveUserData(spreadsheet, userData) {
  try {
    // 「ユーザー」シートを取得または作成
    let userSheet = spreadsheet.getSheetByName(GAS_CONFIG.SHEET_NAMES.USERS);
    
    if (!userSheet) {
      // シートが存在しない場合は作成
      userSheet = spreadsheet.insertSheet(GAS_CONFIG.SHEET_NAMES.USERS);
      
      // ヘッダー行を追加
      userSheet.appendRow([
        'タイムスタンプ',
        'ユーザーID',
        '名前',
        'メールアドレス',
        'プロフィール画像URL'
      ]);
    }
    
    // ユーザーIDが空の場合は追加しない
    if (!userData.sub) {
      Logger.log('ユーザーIDが空です');
      return;
    }
    
    // 既存のユーザーIDをチェック
    const existingData = userSheet.getDataRange().getValues();
    
    if (existingData.length > 1) {
      const existingUserIds = existingData.slice(1).map(row => row[1]); // B列のユーザーID
      
      // ユーザーIDが既に存在する場合は追加しない
      if (existingUserIds.includes(userData.sub)) {
        Logger.log('既存のユーザーです: ' + userData.sub);
        return;
      }
    }
    
    // 新しいユーザーデータを追加
    userSheet.appendRow([
      new Date(),
      userData.sub,
      userData.name,
      userData.email,
      userData.picture
    ]);
    
    Logger.log('新規ユーザーを登録しました: ' + userData.email);
    
  } catch (error) {
    Logger.log('ユーザーデータの保存に失敗しました: ' + error.toString());
    throw error;
  }
}

function loadUserShifts(spreadsheet, userId) {
  try {
    // 「シフト」シートを取得
    const shiftSheet = spreadsheet.getSheetByName(GAS_CONFIG.SHEET_NAMES.SHIFTS);
    
    if (!shiftSheet) {
      Logger.log(`「${GAS_CONFIG.SHEET_NAMES.SHIFTS}」シートが見つかりません`);
      return [];
    }
    
    // データを取得（ヘッダー行を除く）
    const data = shiftSheet.getDataRange().getValues();
    
    if (data.length <= 1) {
      Logger.log('シフトデータがありません');
      return [];
    }
    
    // ユーザーのシフトデータをフィルタリング
    const userShifts = data.slice(1).filter(row => {
      return row.length >= 7 && row[1] === userId; // B列のユーザーIDでフィルタ
    }).map(row => {
      let dateStr = '';
      try {
        // 日付の形式を統一
        const dateValue = row[4]; // E列のシフト日付
        if (dateValue instanceof Date) {
          dateStr = Utilities.formatDate(dateValue, Session.getScriptTimeZone(), 'yyyy-MM-dd');
        } else if (typeof dateValue === 'string') {
          dateStr = dateValue;
        }
      } catch (e) {
        Logger.log('日付の変換に失敗しました: ' + e.toString());
        dateStr = '';
      }
      
      return {
        registrationDate: row[0], // A列: 登録日時
        userId: row[1],          // B列: ユーザーID
        userName: row[2],        // C列: ユーザー名
        userEmail: row[3],       // D列: メールアドレス
        shiftDate: dateStr,      // E列: シフト日付
        timeSlot: row[5],        // F列: 時間帯
        content: row[6]          // G列: 予定内容
      };
    }).filter(item => item.shiftDate !== ''); // 有効な日付のみ
    
    // 日付でソート（古い順）
    userShifts.sort((a, b) => {
      const dateA = new Date(a.shiftDate);
      const dateB = new Date(b.shiftDate);
      return dateA - dateB;
    });
    
    Logger.log(`${userShifts.length}件のユーザーシフトを読み込みました`);
    return userShifts;
    
  } catch (error) {
    Logger.log('ユーザーシフトの読み込みに失敗しました: ' + error.toString());
    return [];
  }
}

function loadShiftCounts(spreadsheet) {
  try {
    // 「シフト」シートを取得
    const shiftSheet = spreadsheet.getSheetByName(GAS_CONFIG.SHEET_NAMES.SHIFTS);
    
    if (!shiftSheet) {
      Logger.log(`「${GAS_CONFIG.SHEET_NAMES.SHIFTS}」シートが見つかりません`);
      return {};
    }
    
    // データを取得（ヘッダー行を除く）
    const data = shiftSheet.getDataRange().getValues();
    
    if (data.length <= 1) {
      Logger.log('シフトデータがありません');
      return {};
    }
    
    // 日付と時間枠ごとのシフト申請数をカウント
    const shiftCounts = {};
    
    Logger.log(`データ行数: ${data.length - 1}行（ヘッダー除く）`);
    
    data.slice(1).forEach((row, index) => {
      Logger.log(`行 ${index + 2}: ${JSON.stringify(row)}`);
      
      if (row.length >= 7) {
        let dateStr = '';
        let timeSlot = '';
        try {
          // 日付の形式を統一（E列：シフト日付）
          const dateValue = row[4];
          Logger.log(`E列の値: ${dateValue}, 型: ${typeof dateValue}`);
          if (dateValue instanceof Date) {
            dateStr = Utilities.formatDate(dateValue, Session.getScriptTimeZone(), 'yyyy-MM-dd');
          } else if (typeof dateValue === 'string') {
            dateStr = dateValue;
          }
          
          // 時間枠（F列）
          timeSlot = row[5] || '';
          Logger.log(`F列の値: "${timeSlot}", 型: ${typeof timeSlot}`);
        } catch (e) {
          Logger.log('データの変換に失敗しました: ' + e.toString());
        }
        
        if (dateStr && timeSlot) {
          Logger.log(`処理中: 日付=${dateStr}, 時間枠="${timeSlot}"`);
          
          // 現在のshiftCountsの状態をログ出力
          Logger.log(`現在のshiftCounts[${dateStr}]:`, JSON.stringify(shiftCounts[dateStr]));
          
          // 日付をキーとしたオブジェクトを初期化
          if (!shiftCounts[dateStr]) {
            shiftCounts[dateStr] = {};
            Logger.log(`新しい日付 ${dateStr} を初期化`);
          }
          
          // オブジェクトかどうか確認
          if (typeof shiftCounts[dateStr] !== 'object' || shiftCounts[dateStr] === null) {
            Logger.log(`警告: shiftCounts[${dateStr}]がオブジェクトではありません:`, typeof shiftCounts[dateStr], shiftCounts[dateStr]);
            shiftCounts[dateStr] = {};
          }
          
          // 時間枠ごとのカウントを初期化
          if (!shiftCounts[dateStr][timeSlot]) {
            shiftCounts[dateStr][timeSlot] = 0;
            Logger.log(`新しい時間枠 ${dateStr} "${timeSlot}" を初期化`);
          }
          shiftCounts[dateStr][timeSlot]++;
          Logger.log(`${dateStr} "${timeSlot}" のカウントを ${shiftCounts[dateStr][timeSlot]} に更新`);
          Logger.log(`更新後のshiftCounts[${dateStr}]:`, JSON.stringify(shiftCounts[dateStr]));
        }
      }
    });
    
    // ログ出力とデバッグ
    let totalSlots = 0;
    Object.keys(shiftCounts).forEach(date => {
      totalSlots += Object.keys(shiftCounts[date]).length;
      // 2025-07-23の詳細をログ出力
      if (date === '2025-07-23') {
        Logger.log(`デバッグ - ${date}の時間枠:`, JSON.stringify(shiftCounts[date]));
        Object.keys(shiftCounts[date]).forEach(timeSlot => {
          Logger.log(`  時間枠: "${timeSlot}" = ${shiftCounts[date][timeSlot]}`);
        });
      }
    });
    Logger.log(`${Object.keys(shiftCounts).length}日分、${totalSlots}個の時間枠でシフト申請数を集計しました`);
    Logger.log('返すshiftCounts:', JSON.stringify(shiftCounts));
    
    // 特定の日付の詳細をログ出力
    if (shiftCounts['2025-07-23']) {
      Logger.log('2025-07-23の返す前の詳細:', typeof shiftCounts['2025-07-23'], JSON.stringify(shiftCounts['2025-07-23']));
    }
    
    return shiftCounts;
    
  } catch (error) {
    Logger.log('シフト申請数の読み込みに失敗しました: ' + error.toString());
    return {};
  }
}

// デバッグ用のテスト関数
function testLoadShiftCounts() {
  Logger.log('=== テスト関数開始 ===');
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const result = loadShiftCounts(spreadsheet);
  Logger.log('=== テスト関数終了 ===');
  Logger.log('結果:', JSON.stringify(result));
  return result;
}

function syncAllShiftsToCalendar() {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const shiftSheet = spreadsheet.getSheetByName(GAS_CONFIG.SHEET_NAMES.SHIFTS);
    
    if (!shiftSheet) {
      throw new Error(`「${GAS_CONFIG.SHEET_NAMES.SHIFTS}」シートが見つかりません`);
    }
    
    // カレンダーを取得
    const calendar = CalendarApp.getCalendarById(GAS_CONFIG.CALENDAR_ID);
    
    if (!calendar) {
      throw new Error('カレンダーが見つかりません: ' + GAS_CONFIG.CALENDAR_ID);
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
