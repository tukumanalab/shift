// Google Apps Script用のJavaScriptコード
// このファイルをGoogle Apps Scriptエディタにコピー&ペーストしてください

// 設定値をプロパティサービスから取得
function getCalendarId() {
  const properties = PropertiesService.getScriptProperties();
  const calendarId = properties.getProperty('CALENDAR_ID');
  
  if (!calendarId) {
    throw new Error('CALENDAR_IDが設定されていません。Google Apps Scriptのプロパティサービスで設定してください。');
  }
  
  return calendarId;
}


function doGet(e) {
  try {
    const params = e.parameter;
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    
    // JSONP対応: callbackパラメータがある場合はJSONPレスポンスを返す
    const callback = params.callback;
    
    let responseData;
    
    if (params.type === 'loadCapacity') {
      // 人数設定データの読み込み
      const capacityData = loadCapacitySettings(spreadsheet);
      responseData = {success: true, data: capacityData};
        
    } else if (params.type === 'loadMyShifts' && params.userId) {
      // ユーザーのシフトデータの読み込み
      const shiftsData = loadUserShifts(spreadsheet, params.userId);
      responseData = {success: true, data: shiftsData};
        
    } else if (params.type === 'loadShiftCounts') {
      // シフト申請数の読み込み
      const shiftCounts = loadShiftCounts(spreadsheet);
      responseData = {success: true, data: shiftCounts};
        
    } else if (params.type === 'checkDuplicate' && params.userId && params.date && params.time) {
      // 単一時間枠の重複チェック
      const isDuplicate = checkDuplicateShift(spreadsheet, params.userId, params.date, params.time);
      responseData = {success: true, isDuplicate: isDuplicate};
        
    } else if (params.type === 'checkMultipleDuplicates' && params.userId && params.date && params.timeSlots) {
      // 複数時間枠の一括重複チェック
      const timeSlots = JSON.parse(params.timeSlots);
      const duplicateResults = checkMultipleDuplicates(spreadsheet, params.userId, params.date, timeSlots);
      responseData = {success: true, duplicates: duplicateResults};
    } else if (params.type === 'getUserProfile' && params.userId) {
      // ユーザープロフィールの取得
      const userProfile = getUserProfile(spreadsheet, params.userId);
      responseData = {success: true, data: userProfile};
    } else if (params.type === 'updateUserProfile' && params.userId) {
      // ユーザープロフィールの更新
      const result = updateUserProfile(spreadsheet, params.userId, params.nickname, params.realName);
      responseData = {success: result};
    } else {
      responseData = {success: false, error: 'Invalid request'};
    }
    
    // JSONP対応: callbackがある場合はJSONPレスポンス、ない場合は通常のJSONレスポンス
    if (callback) {
      return ContentService
        .createTextOutput(callback + '(' + JSON.stringify(responseData) + ');')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    } else {
      return ContentService
        .createTextOutput(JSON.stringify(responseData))
        .setMimeType(ContentService.MimeType.JSON);
    }
      
  } catch (error) {
    const errorResponse = {success: false, error: error.toString()};
    const callback = e.parameter.callback;
    
    if (callback) {
      return ContentService
        .createTextOutput(callback + '(' + JSON.stringify(errorResponse) + ');')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    } else {
      return ContentService
        .createTextOutput(JSON.stringify(errorResponse))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }
}

// CORS対応のためのOPTIONSリクエスト処理
function doOptions(e) {
  // OPTIONSリクエストには空のレスポンスを返す
  return ContentService
    .createTextOutput('')
    .setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    
    
    if (data.type === 'shift') {
      // 単一シフトデータの処理（従来の処理）
      const result = processSingleShiftRequest(spreadsheet, data);
      if (!result.success) {
        return ContentService
          .createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON)
          .setStatusCode(result.statusCode || 400);
      }
      
    } else if (data.type === 'multipleShifts') {
      // 複数シフト申請の一括処理
      const results = processMultipleShiftRequests(spreadsheet, data);
      
      return ContentService
        .createTextOutput(JSON.stringify(results))
        .setMimeType(ContentService.MimeType.JSON);
      
    } else if (data.type === 'deleteShift') {
      // シフト削除処理（管理者専用）
      const result = deleteShiftRequest(spreadsheet, data);
      
      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
      
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
      // カレンダーから既存のシフトを削除してから全シフトを同期
      deleteAllShiftsFromCalendar();
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

// 表示名を取得するヘルパー関数
function getDisplayName(nickname, realName, fallbackName) {
  const hasNickname = nickname && nickname.trim() !== '';
  const hasRealName = realName && realName.trim() !== '';
  
  if (hasNickname && hasRealName) {
    return nickname + '(' + realName + ')';
  } else if (hasNickname) {
    return nickname;
  } else if (hasRealName) {
    return realName;
  } else {
    return fallbackName || 'ユーザー';
  }
}

function addToCalendar(shiftData) {
  try {
    // カレンダーを取得
    const calendar = CalendarApp.getCalendarById(getCalendarId());
    
    if (!calendar) {
      throw new Error('カレンダーが見つかりません: ' + getCalendarId());
    }
    
    Logger.log(`シフトデータを処理中: ${JSON.stringify(shiftData)}`);
    
    // 日付文字列の処理を改善
    let shiftDate;
    if (shiftData.date instanceof Date) {
      shiftDate = new Date(shiftData.date);
    } else if (typeof shiftData.date === 'string') {
      // YYYY-MM-DD形式の文字列を想定
      shiftDate = new Date(shiftData.date + 'T00:00:00');
    } else {
      throw new Error('無効な日付形式: ' + shiftData.date);
    }
    
    Logger.log(`解析された日付: ${shiftDate}`);
    
    // 時間情報を解析（例: "13:00-13:30"）
    const [startTime, endTime] = shiftData.time.split('-');
    const [startHour, startMinute] = startTime.trim().split(':').map(Number);
    const [endHour, endMinute] = endTime.trim().split(':').map(Number);
    
    Logger.log(`時間情報: ${startHour}:${startMinute} - ${endHour}:${endMinute}`);
    
    // 開始時刻と終了時刻のDateオブジェクトを作成
    const startDateTime = new Date(shiftDate);
    startDateTime.setHours(startHour, startMinute, 0, 0);
    
    const endDateTime = new Date(shiftDate);
    endDateTime.setHours(endHour, endMinute, 0, 0);
    
    Logger.log(`設定された開始時刻: ${startDateTime}`);
    Logger.log(`設定された終了時刻: ${endDateTime}`);
    
    // 表示名を取得
    const displayName = getDisplayName(shiftData.nickname, shiftData.realName, shiftData.userName);
    
    // イベントのタイトルと詳細を作成
    const title = displayName;
    const description = `担当者: ${displayName}
メール: ${shiftData.userEmail}
時間: ${shiftData.time}`;
    
    // カレンダーにイベントを追加
    const event = calendar.createEvent(title, startDateTime, endDateTime, {
      description: description,
      location: 'つくまなラボ'  // 必要に応じて場所を設定
    });
    
    Logger.log(`カレンダーイベントを作成しました: ${title} (${startDateTime} - ${endDateTime})`);
    
  } catch (error) {
    Logger.log(`カレンダーへの追加に失敗しました: ${error.toString()}`);
    Logger.log(`シフトデータ: ${JSON.stringify(shiftData)}`);
    throw error;
  }
}


function loadCapacitySettings(spreadsheet) {
  try {
    // 「人数設定」シートを取得
    const capacitySheet = spreadsheet.getSheetByName('人数設定');
    
    if (!capacitySheet) {
      Logger.log(`「人数設定」シートが見つかりません`);
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
        capacity: parseInt(row[2]) || 0,
        memo: row[5] || ''
      };
    }).filter(item => item.date !== ''); // 有効な日付のみ
    
    return capacityData;
    
  } catch (error) {
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
        '更新者名',
        'メモ'
      ]);
      
      // 年度末までの全日付のデータを初期化
      initializeCapacityData(capacitySheet);
    }
    
    // 既存のデータから更新対象の日付のみ更新
    updateCapacityData(capacitySheet, capacityData);
    
    
  } catch (error) {
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
        'システム初期化',
        ''
      ]);
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // 一括でデータを追加
    if (initData.length > 0) {
      capacitySheet.getRange(2, 1, initData.length, 6).setValues(initData);
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
        capacitySheet.getRange(rowNumber, 1, 1, 6).setValues([[
          new Date(item.timestamp),
          item.date,
          item.capacity,
          item.userId,
          item.userName,
          item.memo || ''
        ]]);
      } else {
        // 新しい日付の場合は追加
        capacitySheet.appendRow([
          new Date(item.timestamp),
          item.date,
          item.capacity,
          item.userId,
          item.userName,
          item.memo || ''
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
    let userSheet = spreadsheet.getSheetByName('ユーザー');
    
    if (!userSheet) {
      // シートが存在しない場合は作成
      userSheet = spreadsheet.insertSheet('ユーザー');
      
      // ヘッダー行を追加
      userSheet.appendRow([
        'タイムスタンプ',
        'ユーザーID',
        '名前',
        'メールアドレス',
        'プロフィール画像URL',
        'ニックネーム',
        '本名'
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
      userData.picture,
      '', // ニックネーム（初期値は空）
      ''  // 本名（初期値は空）
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
    const shiftSheet = spreadsheet.getSheetByName('シフト');
    
    if (!shiftSheet) {
      Logger.log(`「シフト」シートが見つかりません`);
      return [];
    }
    
    // ユーザー情報を取得（表示名とメールアドレスのため）
    const userSheet = spreadsheet.getSheetByName('ユーザー');
    const userProfiles = {};
    
    if (userSheet) {
      const userData = userSheet.getDataRange().getValues();
      if (userData.length > 1) {
        // ヘッダー行をスキップしてユーザー情報をマップ化
        for (let i = 1; i < userData.length; i++) {
          const userRow = userData[i];
          if (userRow[1]) { // ユーザーIDが存在する場合
            userProfiles[userRow[1]] = {
              name: userRow[2] || '',      // C列: 名前
              email: userRow[3] || '',     // D列: メールアドレス
              nickname: userRow[5] || '',  // F列: ニックネーム
              realName: userRow[6] || ''   // G列: 本名
            };
          }
        }
      }
    }
    
    // データを取得（ヘッダー行を除く）
    const data = shiftSheet.getDataRange().getValues();
    
    if (data.length <= 1) {
      Logger.log('シフトデータがありません');
      return [];
    }
    
    // ユーザーのシフトデータをフィルタリング（管理者の場合は全員のデータを返す）
    const userShifts = data.slice(1).filter(row => {
      return row.length >= 4 && (userId === 'admin' || row[1] === userId); // 管理者または指定ユーザー
    }).map(row => {
      let dateStr = '';
      try {
        // 日付の形式を統一
        const dateValue = row[2]; // C列のシフト日付
        if (dateValue instanceof Date) {
          dateStr = Utilities.formatDate(dateValue, Session.getScriptTimeZone(), 'yyyy-MM-dd');
        } else if (typeof dateValue === 'string') {
          dateStr = dateValue;
        }
      } catch (e) {
        Logger.log('日付の変換に失敗しました: ' + e.toString());
        dateStr = '';
      }
      
      const userProfile = userProfiles[row[1]] || {};
      const displayName = getDisplayName(userProfile.nickname, userProfile.realName, userProfile.name);
      
      return {
        registrationDate: row[0], // A列: 登録日時
        userId: row[1],          // B列: ユーザーID
        userName: row[4] || displayName,   // E列: 名前（なければ表示名）
        userEmail: userProfile.email || '', // メール（ユーザータブから取得）
        shiftDate: dateStr,      // C列: シフト日付
        timeSlot: row[3],        // D列: 時間帯
        content: 'シフト',       // 固定値
        nickname: userProfile.nickname || '', // ニックネーム
        realName: userProfile.realName || ''  // 本名
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

function loadShiftCounts() {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

    // 「シフト」シートを取得
    const shiftSheet = spreadsheet.getSheetByName('シフト');
    
    if (!shiftSheet) {
      Logger.log(`「シフト」シートが見つかりません`);
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
    
    
    data.slice(1).forEach((row) => {
      if (row.length >= 4) {
        let dateStr = '';
        let timeSlot = '';
        try {
          // 日付の形式を統一（C列：シフト日付）
          const dateValue = row[2];
          if (dateValue instanceof Date) {
            dateStr = Utilities.formatDate(dateValue, Session.getScriptTimeZone(), 'yyyy-MM-dd');
          } else if (typeof dateValue === 'string') {
            dateStr = dateValue;
          }
          
          // 時間枠（D列）
          timeSlot = row[3] || '';
        } catch (e) {
          Logger.log('データの変換に失敗しました: ' + e.toString());
        }
        
        if (dateStr && timeSlot) {
          // 日付をキーとしたオブジェクトを初期化
          if (!shiftCounts[dateStr]) {
            shiftCounts[dateStr] = {};
          }
          
          // オブジェクトかどうか確認
          if (typeof shiftCounts[dateStr] !== 'object' || shiftCounts[dateStr] === null) {
            shiftCounts[dateStr] = {};
          }
          
          // 時間枠ごとのカウントを初期化
          if (!shiftCounts[dateStr][timeSlot]) {
            shiftCounts[dateStr][timeSlot] = 0;
          }
          shiftCounts[dateStr][timeSlot]++;
        }
      }
    });
    
    return shiftCounts;
    
  } catch (error) {
    Logger.log('シフト申請数の読み込みに失敗しました: ' + error.toString());
    return {};
  }
}

function syncAllShiftsToCalendar() {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const shiftSheet = spreadsheet.getSheetByName('シフト');
    
    if (!shiftSheet) {
      throw new Error(`「シフト」シートが見つかりません`);
    }
    
    // カレンダーを取得
    const calendar = CalendarApp.getCalendarById(getCalendarId());
    
    if (!calendar) {
      throw new Error('カレンダーが見つかりません: ' + getCalendarId());
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
    
    // ユーザー情報を取得（表示名のため）
    const userSheet = spreadsheet.getSheetByName('ユーザー');
    const userProfiles = {};
    
    if (userSheet) {
      const userData = userSheet.getDataRange().getValues();
      if (userData.length > 1) {
        // ヘッダー行をスキップしてユーザー情報をマップ化
        for (let i = 1; i < userData.length; i++) {
          const userRow = userData[i];
          if (userRow[1]) { // ユーザーIDが存在する場合
            userProfiles[userRow[1]] = {
              name: userRow[2] || '',      // C列: 名前
              email: userRow[3] || '',     // D列: メールアドレス
              nickname: userRow[5] || '',  // F列: ニックネーム
              realName: userRow[6] || ''   // G列: 本名
            };
          }
        }
      }
    }

    // シフトデータを取得（ヘッダー行を除く）
    const shiftData = shiftSheet.getDataRange().getValues().slice(1);
    
    // ユーザーと日付ごとにシフトをグループ化
    const groupedShifts = {};
    
    shiftData.forEach(row => {
      if (row.length >= 4) {
        const userProfile = userProfiles[row[1]] || {};
        const shiftInfo = {
          userId: row[1],
          userName: getDisplayName(userProfile.nickname, userProfile.realName, userProfile.name),
          userEmail: userProfile.email || '',
          date: row[2],
          time: row[3],
          content: 'シフト',
          nickname: userProfile.nickname || '',
          realName: userProfile.realName || ''
        };
        
        // 日付が有効かチェック
        const shiftDate = new Date(shiftInfo.date);
        if (shiftDate >= now) { // 今日以降の予定のみ
          const key = `${shiftInfo.userId}_${shiftInfo.date}`;
          if (!groupedShifts[key]) {
            groupedShifts[key] = {
              userId: shiftInfo.userId,
              userName: shiftInfo.userName,
              userEmail: shiftInfo.userEmail,
              date: shiftInfo.date,
              timeSlots: [],
              content: shiftInfo.content,
              nickname: shiftInfo.nickname,
              realName: shiftInfo.realName
            };
          }
          groupedShifts[key].timeSlots.push(shiftInfo.time);
        }
      }
    });
    
    // 各グループについて時間帯をマージしてカレンダーに追加
    let syncCount = 0;
    Object.values(groupedShifts).forEach(group => {
      // 時間帯をソートして連続する時間帯をマージ
      const mergedTimeRanges = mergeConsecutiveTimeSlots(group.timeSlots);
      
      // マージされた各時間帯をカレンダーに追加
      mergedTimeRanges.forEach(timeRange => {
        const shiftInfo = {
          userId: group.userId,
          userName: group.userName,
          userEmail: group.userEmail,
          date: group.date,
          time: timeRange,
          content: group.content,
          nickname: group.nickname,
          realName: group.realName
        };
        addToCalendar(shiftInfo);
        syncCount++;
      });
    });
    
    Logger.log(`${syncCount}件のシフトをカレンダーに同期しました`);
    
  } catch (error) {
    Logger.log('一括同期に失敗しました: ' + error.toString());
    throw error;
  }
}

// カレンダーからすべてのシフト関連イベントを削除する関数
function deleteAllShiftsFromCalendar() {
  try {
    // カレンダーを取得
    const calendar = CalendarApp.getCalendarById(getCalendarId());
    
    if (!calendar) {
      throw new Error('カレンダーが見つかりません: ' + getCalendarId());
    }
    
    // 過去1年から未来1年までのイベントを取得
    const now = new Date();
    const pastDate = new Date(now.getTime() - (365 * 24 * 60 * 60 * 1000)); // 1年前
    const futureDate = new Date(now.getTime() + (365 * 24 * 60 * 60 * 1000)); // 1年後
    const events = calendar.getEvents(pastDate, futureDate);
    
    let deletedCount = 0;
    
    // シフト関連のイベントを削除
    events.forEach(event => {
      // シフト関連のイベントを識別（タイトルに「 - 」が含まれ、説明に「担当者:」が含まれる）
      if (event.getTitle().includes(' - ') && event.getDescription().includes('担当者:')) {
        event.deleteEvent();
        deletedCount++;
      }
    });
    
    Logger.log(`${deletedCount}件のシフト関連イベントをカレンダーから削除しました`);
    
  } catch (error) {
    Logger.log('カレンダーからのシフト削除に失敗しました: ' + error.toString());
    throw error;
  }
}

// テスト用：7/28の13:00-13:30にシフト申請を追加する関数
function addTestShiftFor728() {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const shiftSheet = spreadsheet.getSheetByName('シフト');
    
    if (!shiftSheet) {
      throw new Error('「シフト」シートが見つかりません');
    }
    
    // テスト用のシフト申請を追加
    shiftSheet.appendRow([
      new Date(), // A列: 登録日時
      'test_user_id', // B列: ユーザーID
      'テストユーザー', // C列: ユーザー名
      'test@example.com', // D列: メールアドレス
      '2025-07-28', // E列: シフト日付
      '13:00-13:30', // F列: 時間帯
      'テスト用シフト' // G列: 内容
    ]);
    
    Logger.log('7/28の13:00-13:30にテスト用シフト申請を追加しました');
    
    // 追加後の状態を確認
    const result = loadShiftCounts(spreadsheet);
    Logger.log('追加後のシフト申請数:', JSON.stringify(result));
    
    return result;
  } catch (error) {
    Logger.log('テスト用シフト申請の追加に失敗しました: ' + error.toString());
    throw error;
  }
}

// 重複チェック専用関数
function checkDuplicateShift(spreadsheet, userId, date, time) {
  try {
    const shiftSheet = spreadsheet.getSheetByName('シフト');
    
    if (!shiftSheet) {
      return false; // シートが存在しない場合は重複なし
    }
    
    const existingData = shiftSheet.getDataRange().getValues();
    
    if (existingData.length <= 1) {
      return false; // データがない場合は重複なし
    }
    
    // 重複チェック
    const isDuplicate = existingData.slice(1).some(row => {
      let rowDateStr = '';
      try {
        const dateValue = row[2]; // C列: date
        if (dateValue instanceof Date) {
          rowDateStr = Utilities.formatDate(dateValue, Session.getScriptTimeZone(), 'yyyy-MM-dd');
          } else if (typeof dateValue === 'string') {
          rowDateStr = dateValue;
        }
      } catch (e) {
        rowDateStr = '';
      }
      
      return row[1] === userId && // B列: userId
             rowDateStr === date && 
             row[3] === time; // D列: time
    });
    
    return isDuplicate;
    
  } catch (error) {
    Logger.log('重複チェックでエラーが発生しました: ' + error.toString());
    return false; // エラーの場合は重複なしとして扱う
  }
}

// 単一シフト申請の処理
function processSingleShiftRequest(spreadsheet, data) {
  try {
    const shiftSheet = spreadsheet.getSheetByName('シフト');
    
    if (!shiftSheet) {
      return {
        success: false,
        error: 'sheet_not_found',
        message: '「シフト」シートが見つかりません'
      };
    }
    
    // ユーザープロフィールを取得して表示名を決定
    const userProfile = getUserProfile(spreadsheet, data.userId);
    let displayName = data.userName; // デフォルトは元の名前
    
    if (userProfile) {
      displayName = getDisplayName(userProfile.nickname, userProfile.realName, data.userName);
    }
    
    // 重複チェック：同じユーザーが同じ日の同じ時間帯に既に申請していないか確認
    const existingData = shiftSheet.getDataRange().getValues();
    
    if (existingData.length > 1) { // ヘッダー行を除く
      const isDuplicate = existingData.slice(1).some(row => {
        // B列: userId, C列: date, D列: time
        let rowDateStr = '';
        try {
          // C列の日付をYYYY-MM-DD形式に変換
          const dateValue = row[2];
          if (dateValue instanceof Date) {
            rowDateStr = Utilities.formatDate(dateValue, Session.getScriptTimeZone(), 'yyyy-MM-dd');
          } else if (typeof dateValue === 'string') {
            rowDateStr = dateValue;
          }
        } catch (e) {
          rowDateStr = '';
        }
        
        return row[1] === data.userId && 
               rowDateStr === data.date && 
               row[3] === data.time;
      });
      
      if (isDuplicate) {
        return {
          success: false,
          error: 'duplicate',
          message: `${data.date}の${data.time}は既に申請済みです。`,
          statusCode: 409
        };
      }
    }
    
    // シフトデータを追加（ユーザーIDと名前を保存）
    shiftSheet.appendRow([
      new Date(),
      data.userId,
      data.date,
      data.time,
      data.userName  // E列: 名前
    ]);
    
    // Google Calendarに予定を追加（表示名を使用）
    const calendarData = {
      ...data,
      userName: displayName,
      nickname: userProfile ? userProfile.nickname : '',
      realName: userProfile ? userProfile.realName : ''
    };
    addToCalendar(calendarData);
    
    return { success: true };
    
  } catch (error) {
    Logger.log('単一シフト申請の処理でエラー: ' + error.toString());
    return {
      success: false,
      error: error.toString(),
      message: 'シフト申請の処理中にエラーが発生しました'
    };
  }
}

// 複数シフト申請の一括処理
function processMultipleShiftRequests(spreadsheet, requestData) {
  try {
    const shiftSheet = spreadsheet.getSheetByName('シフト');
    
    if (!shiftSheet) {
      return {
        success: false,
        error: 'sheet_not_found',
        message: '「シフト」シートが見つかりません',
        processed: [],
        duplicates: [],
        errors: []
      };
    }
    
    const { userId, userName, userEmail, date, timeSlots, content } = requestData;
    const results = {
      success: true,
      processed: [],
      duplicates: [],
      errors: []
    };
    
    // ユーザープロフィールを取得して表示名を決定
    const userProfile = getUserProfile(spreadsheet, userId);
    let displayName = userName; // デフォルトは元の名前
    
    if (userProfile) {
      displayName = getDisplayName(userProfile.nickname, userProfile.realName, userName);
    }
    
    // 入力検証
    if (!Array.isArray(timeSlots) || timeSlots.length === 0) {
      return {
        success: false,
        error: 'invalid_input',
        message: 'timeSlots配列が必要です',
        processed: [],
        duplicates: [],
        errors: []
      };
    }
    
    // まず全ての時間枠の重複チェックを一括で行う
    const duplicateResults = checkMultipleDuplicates(spreadsheet, userId, date, timeSlots);
    
    // 重複していない時間枠のみを処理
    const validTimeSlots = timeSlots.filter(timeSlot => !duplicateResults[timeSlot]);
    const duplicateTimeSlots = timeSlots.filter(timeSlot => duplicateResults[timeSlot]);
    
    results.duplicates = duplicateTimeSlots;
    
    // 有効な時間枠を一括でスプレッドシートに追加
    if (validTimeSlots.length > 0) {
      const rowsToAdd = validTimeSlots.map(timeSlot => [
        new Date(),
        userId,
        date,
        timeSlot,
        userName  // E列: 名前
      ]);
      
      // 一括でデータを追加（パフォーマンス向上）
      const range = shiftSheet.getRange(shiftSheet.getLastRow() + 1, 1, rowsToAdd.length, 5);
      range.setValues(rowsToAdd);
      
      results.processed = validTimeSlots;
      
      // Google Calendarに予定を追加（連続する時間帯をマージして）
      try {
        const mergedTimeRanges = mergeConsecutiveTimeSlots(validTimeSlots);
        
        mergedTimeRanges.forEach(timeRange => {
          try {
            addToCalendar({
              userId,
              userName: displayName, // 表示名を使用
              userEmail,
              date,
              time: timeRange,
              content: content || 'シフト',
              nickname: userProfile ? userProfile.nickname : '',
              realName: userProfile ? userProfile.realName : ''
            });
          } catch (calendarError) {
            Logger.log(`カレンダー追加エラー (${timeRange}): ${calendarError.toString()}`);
            results.errors.push(`カレンダー追加に失敗: ${timeRange}`);
          }
        });
      } catch (mergeError) {
        Logger.log(`時間範囲マージエラー: ${mergeError.toString()}`);
        // マージに失敗した場合は個別に追加
        validTimeSlots.forEach(timeSlot => {
          try {
            addToCalendar({
              userId,
              userName,
              userEmail,
              date,
              time: timeSlot,
              content: content || 'シフト'
            });
          } catch (calendarError) {
            Logger.log(`カレンダー追加エラー (${timeSlot}): ${calendarError.toString()}`);
            results.errors.push(`カレンダー追加に失敗: ${timeSlot}`);
          }
        });
      }
    }
    
    return results;
    
  } catch (error) {
    Logger.log('複数シフト申請の処理でエラーが発生しました: ' + error.toString());
    return {
      success: false,
      error: error.toString(),
      message: '複数シフト申請の処理中にエラーが発生しました',
      processed: [],
      duplicates: [],
      errors: [error.toString()]
    };
  }
}

// 複数時間枠の一括重複チェック
function checkMultipleDuplicates(spreadsheet, userId, date, timeSlots) {
  try {
    const shiftSheet = spreadsheet.getSheetByName('シフト');
    
    if (!shiftSheet) {
      return {}; // シートが存在しない場合は重複なし
    }
    
    const existingData = shiftSheet.getDataRange().getValues();
    
    if (existingData.length <= 1) {
      return {}; // データがない場合は重複なし
    }
    
    const duplicates = {};
    
    // 各時間枠について重複をチェック
    timeSlots.forEach(timeSlot => {
      const isDuplicate = existingData.slice(1).some(row => {
        let rowDateStr = '';
        try {
          const dateValue = row[2]; // C列: date
          if (dateValue instanceof Date) {
            rowDateStr = Utilities.formatDate(dateValue, Session.getScriptTimeZone(), 'yyyy-MM-dd');
          } else if (typeof dateValue === 'string') {
            rowDateStr = dateValue;
          }
        } catch (e) {
          rowDateStr = '';
        }
        
        return row[1] === userId && // B列: userId
               rowDateStr === date && 
               row[3] === timeSlot; // D列: time
      });
      
      duplicates[timeSlot] = isDuplicate;
    });
    
    return duplicates;
    
  } catch (error) {
    Logger.log('一括重複チェックでエラーが発生しました: ' + error.toString());
    return {};
  }
}

// シフト削除処理（管理者専用）
function deleteShiftRequest(spreadsheet, data) {
  try {
    const shiftSheet = spreadsheet.getSheetByName('シフト');
    
    if (!shiftSheet) {
      return {
        success: false,
        error: 'sheet_not_found',
        message: '「シフト」シートが見つかりません'
      };
    }
    
    const { userId, userName, userEmail, date, time, timeSlots, adminUserId } = data;
    
    // 権限チェック: 管理者または本人のシフトのみ削除可能
    if (!adminUserId && !userId) {
      return {
        success: false,
        error: 'unauthorized',
        message: '権限がありません'
      };
    }
    
    // 削除対象の時間スロット配列を取得（timeSlots優先、なければtimeを配列化）
    const targetTimeSlots = timeSlots || [time];
    
    const allData = shiftSheet.getDataRange().getValues();
    const deletedRows = [];
    
    // 各時間スロットについて削除対象を検索
    for (const timeSlot of targetTimeSlots) {
      for (let i = 1; i < allData.length; i++) {
        const row = allData[i];
        let rowDateStr = '';
        
        try {
          const dateValue = row[2]; // C列: date
          if (dateValue instanceof Date) {
            rowDateStr = Utilities.formatDate(dateValue, Session.getScriptTimeZone(), 'yyyy-MM-dd');
          } else if (typeof dateValue === 'string') {
            rowDateStr = dateValue;
          }
        } catch (e) {
          rowDateStr = '';
        }
        
        // 条件に一致するシフトを検索（ユーザーIDと日付、時間のみで判定）
        if (row[1] === userId &&     // B列: userId
            rowDateStr === date &&   // C列: date
            row[3] === timeSlot) {   // D列: time
          deletedRows.push({ index: i + 1, timeSlot: timeSlot }); // スプレッドシートの行番号（1ベース）
          break;
        }
      }
    }
    
    if (deletedRows.length === 0) {
      return {
        success: false,
        error: 'not_found',
        message: '該当するシフトが見つかりません'
      };
    }
    
    // 行番号を降順でソートして削除（後ろから削除することで行番号のずれを防ぐ）
    deletedRows.sort((a, b) => b.index - a.index);
    
    // 行を削除
    for (const deleteInfo of deletedRows) {
      shiftSheet.deleteRow(deleteInfo.index);
    }
    
    // Google Calendarからも削除（各時間スロットについて）
    for (const deleteInfo of deletedRows) {
      try {
        deleteFromCalendar({
          userId,
          userName,
          userEmail,
          date,
          time: deleteInfo.timeSlot
        });
      } catch (calendarError) {
        Logger.log('カレンダーからの削除に失敗: ' + calendarError.toString());
        // カレンダー削除の失敗は警告のみ
      }
    }
    
    return {
      success: true,
      message: `${deletedRows.length}件のシフトを削除しました`,
      deletedCount: deletedRows.length
    };
    
  } catch (error) {
    Logger.log('シフト削除処理でエラー: ' + error.toString());
    return {
      success: false,
      error: error.toString(),
      message: 'シフト削除中にエラーが発生しました'
    };
  }
}

// 連続する時間帯をマージする関数
function mergeConsecutiveTimeSlots(timeSlots) {
  if (timeSlots.length === 0) return [];
  
  // 時間帯を開始時刻でソート
  const sorted = timeSlots.sort((a, b) => {
    const timeA = a.replace(/(\d+):(\d+)-(\d+):(\d+)/, '$1$2');
    const timeB = b.replace(/(\d+):(\d+)-(\d+):(\d+)/, '$1$2');
    return parseInt(timeA) - parseInt(timeB);
  });
  
  const merged = [];
  let currentStart = sorted[0].split('-')[0];
  let currentEnd = sorted[0].split('-')[1];
  
  for (let i = 1; i < sorted.length; i++) {
    const [nextStart, nextEnd] = sorted[i].split('-');
    
    // 現在の終了時刻と次の開始時刻が一致すれば連続
    if (currentEnd === nextStart) {
      currentEnd = nextEnd;
    } else {
      // 連続していない場合は現在の範囲を保存して新しい範囲を開始
      merged.push(`${currentStart}-${currentEnd}`);
      currentStart = nextStart;
      currentEnd = nextEnd;
    }
  }
  
  // 最後の範囲を追加
  merged.push(`${currentStart}-${currentEnd}`);
  
  return merged;
}

// Google Calendarからシフトを削除する関数
function deleteFromCalendar(shiftData) {
  try {
    const calendar = CalendarApp.getCalendarById(getCalendarId());
    
    if (!calendar) {
      throw new Error('カレンダーが見つかりません: ' + getCalendarId());
    }
    
    // 該当する日付のイベントを検索
    const shiftDate = new Date(shiftData.date);
    const startDate = new Date(shiftDate);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(shiftDate);
    endDate.setHours(23, 59, 59, 999);
    
    const events = calendar.getEvents(startDate, endDate);
    
    // 条件に一致するイベントを削除
    const targetTitle = `${shiftData.userName} - `;
    events.forEach(event => {
      if (event.getTitle().startsWith(targetTitle) && 
          event.getDescription().includes(shiftData.userEmail) &&
          event.getDescription().includes(shiftData.time)) {
        event.deleteEvent();
        Logger.log('カレンダーからイベントを削除しました: ' + event.getTitle());
      }
    });
    
  } catch (error) {
    Logger.log('カレンダーからの削除に失敗しました: ' + error.toString());
    throw error;
  }
}


// ユーザープロフィールを取得する関数
function getUserProfile(spreadsheet, userId) {
  try {
    const userSheet = spreadsheet.getSheetByName('ユーザー');
    
    if (!userSheet) {
      return null;
    }
    
    const data = userSheet.getDataRange().getValues();
    
    if (data.length <= 1) {
      return null;
    }
    
    // ヘッダー行をスキップして、ユーザーIDで検索
    for (let i = 1; i < data.length; i++) {
      if (data[i][1] === userId) { // B列: ユーザーID
        return {
          nickname: data[i][5] || '', // F列: ニックネーム
          realName: data[i][6] || ''   // G列: 本名
        };
      }
    }
    
    return null;
    
  } catch (error) {
    Logger.log('ユーザープロフィールの取得に失敗しました: ' + error.toString());
    return null;
  }
}

// ユーザープロフィールを更新する関数
function updateUserProfile(spreadsheet, userId, nickname, realName) {
  try {
    const userSheet = spreadsheet.getSheetByName('ユーザー');
    
    if (!userSheet) {
      return false;
    }
    
    const data = userSheet.getDataRange().getValues();
    
    if (data.length <= 1) {
      return false;
    }
    
    // ヘッダー行をスキップして、ユーザーIDで検索
    for (let i = 1; i < data.length; i++) {
      if (data[i][1] === userId) { // B列: ユーザーID
        // F列（ニックネーム）とG列（本名）を更新
        userSheet.getRange(i + 1, 6).setValue(nickname || ''); // F列
        userSheet.getRange(i + 1, 7).setValue(realName || '');  // G列
        
        Logger.log('ユーザープロフィールを更新しました: ' + userId);
        return true;
      }
    }
    
    return false;
    
  } catch (error) {
    Logger.log('ユーザープロフィールの更新に失敗しました: ' + error.toString());
    return false;
  }
}
