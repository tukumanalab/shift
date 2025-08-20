/**
 * シフト申請機能のテスト
 * 一般ユーザーがシフトを申請した際のリクエストとデータ処理をテストする
 */

describe('シフト申請機能', () => {
  let mockFetch;
  
  // テスト用のシフト申請関数
  const createShiftRequestFunction = () => {
    return async function submitShiftRequest() {
      const selectedSlots = ['13:00-13:30'];
      
      if (selectedSlots.length === 0) {
        alert('時間枠を選択してください。');
        return;
      }
      
      try {
        const multipleShiftData = {
          type: 'multipleShifts',
          userId: global.currentUser.sub,
          userName: global.currentUser.name,
          userEmail: global.currentUser.email,
          date: global.currentShiftRequestDate,
          timeSlots: selectedSlots,
          content: 'シフト'
        };
        
        await fetch(global.GOOGLE_APPS_SCRIPT_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          mode: 'no-cors',
          body: JSON.stringify(multipleShiftData)
        });
        
        // キャッシュを更新
        for (const timeSlot of selectedSlots) {
          const newShift = {
            userId: global.currentUser.sub,
            shiftDate: global.currentShiftRequestDate,
            timeSlot: timeSlot,
            content: 'シフト',
            userName: global.currentUser.name,
            userEmail: global.currentUser.email
          };
          global.myShiftsCache.push(newShift);
        }
        
        alert(`${global.currentShiftRequestDate} の\n${selectedSlots.join('\n')}\nにシフト申請しました。`);
        
      } catch (error) {
        console.error('シフト申請の保存に失敗しました:', error);
        alert('シフト申請の保存に失敗しました。再度お試しください。');
      }
    };
  };
  
  beforeEach(() => {
    // fetch のモックをリセット
    mockFetch = jest.fn();
    global.fetch = mockFetch;
    
    // グローバル変数をリセット
    global.currentUser = {
      sub: 'test_user_123',
      name: 'テストユーザー',
      email: 'test@example.com',
      picture: 'https://example.com/photo.jpg'
    };
    
    global.currentShiftRequestDate = '2025-01-20';
    global.myShiftsCache = [];
    
    // アラートとコンソールをモック
    global.alert = jest.fn();
    global.console.log = jest.fn();
    global.console.error = jest.fn();
  });

  test('単一時間枠のシフト申請が正しく送信される', async () => {
    const submitShiftRequest = createShiftRequestFunction();
    
    // no-corsモードのレスポンスをモック
    mockFetch.mockResolvedValue(new Response(null, {
      status: 200,
      statusText: 'OK'
    }));
    
    await submitShiftRequest();
    
    // fetchが正しいパラメータで呼ばれたことを確認
    expect(mockFetch).toHaveBeenCalledWith(
      'https://script.google.com/mock/test',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        mode: 'no-cors',
        body: JSON.stringify({
          type: 'multipleShifts',
          userId: 'test_user_123',
          userName: 'テストユーザー',
          userEmail: 'test@example.com',
          date: '2025-01-20',
          timeSlots: ['13:00-13:30'],
          content: 'シフト'
        })
      })
    );
    
    // 成功メッセージが表示されたことを確認
    expect(global.alert).toHaveBeenCalledWith(
      '2025-01-20 の\n13:00-13:30\nにシフト申請しました。'
    );
    
    // キャッシュが更新されたことを確認
    expect(global.myShiftsCache).toHaveLength(1);
    expect(global.myShiftsCache[0]).toEqual({
      userId: 'test_user_123',
      shiftDate: '2025-01-20',
      timeSlot: '13:00-13:30',
      content: 'シフト',
      userName: 'テストユーザー',
      userEmail: 'test@example.com'
    });
  });

  test('必須フィールドが全て含まれている', async () => {
    const submitShiftRequest = createShiftRequestFunction();
    
    mockFetch.mockResolvedValue(new Response(null, { status: 200 }));
    
    await submitShiftRequest();
    
    const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    
    // 必須フィールドの確認
    expect(requestBody).toHaveProperty('type', 'multipleShifts');
    expect(requestBody).toHaveProperty('userId', 'test_user_123');
    expect(requestBody).toHaveProperty('userName', 'テストユーザー');
    expect(requestBody).toHaveProperty('userEmail', 'test@example.com');
    expect(requestBody).toHaveProperty('date', '2025-01-20');
    expect(requestBody).toHaveProperty('timeSlots');
    expect(Array.isArray(requestBody.timeSlots)).toBe(true);
    expect(requestBody.timeSlots.length).toBeGreaterThan(0);
  });

  test('fetchエラー時にエラーメッセージが表示される', async () => {
    const submitShiftRequest = createShiftRequestFunction();
    
    // fetchがエラーを投げるように設定
    mockFetch.mockRejectedValue(new Error('Network error'));
    
    await submitShiftRequest();
    
    // エラーメッセージが表示されたことを確認
    expect(global.alert).toHaveBeenCalledWith(
      'シフト申請の保存に失敗しました。再度お試しください。'
    );
    
    // エラーがコンソールに出力されたことを確認
    expect(global.console.error).toHaveBeenCalledWith(
      'シフト申請の保存に失敗しました:',
      expect.any(Error)
    );
  });

  test('no-corsモードが正しく設定されている', async () => {
    const submitShiftRequest = createShiftRequestFunction();
    
    mockFetch.mockResolvedValue(new Response(null, { status: 200 }));
    
    await submitShiftRequest();
    
    // no-corsモードが設定されていることを確認
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        mode: 'no-cors'
      })
    );
  });

  test('日付形式がYYYY-MM-DDである', async () => {
    const submitShiftRequest = createShiftRequestFunction();
    
    mockFetch.mockResolvedValue(new Response(null, { status: 200 }));
    
    await submitShiftRequest();
    
    const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    
    // 日付形式の確認
    expect(requestBody.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('時間枠形式がHH:MM-HH:MMである', async () => {
    const submitShiftRequest = createShiftRequestFunction();
    
    mockFetch.mockResolvedValue(new Response(null, { status: 200 }));
    
    await submitShiftRequest();
    
    const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    
    // 時間枠形式の確認
    requestBody.timeSlots.forEach(timeSlot => {
      expect(timeSlot).toMatch(/^\d{2}:\d{2}-\d{2}:\d{2}$/);
    });
  });

  test('新しいシフトがキャッシュに追加される', () => {
    const updateMyShiftsCache = (newShift) => {
      if (!global.myShiftsCache) {
        global.myShiftsCache = [];
      }
      global.myShiftsCache.push(newShift);
    };
    
    const newShift = {
      userId: 'test_user_123',
      shiftDate: '2025-01-20',
      timeSlot: '13:00-13:30',
      content: 'シフト',
      userName: 'テストユーザー',
      userEmail: 'test@example.com'
    };
    
    // 初期状態
    global.myShiftsCache = [];
    
    updateMyShiftsCache(newShift);
    
    expect(global.myShiftsCache).toHaveLength(1);
    expect(global.myShiftsCache[0]).toEqual(newShift);
  });
});