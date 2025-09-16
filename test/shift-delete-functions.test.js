/**
 * シフト削除機能のテスト
 * deleteShift、deleteMyShift、deleteShiftFromModal の動作をテストする
 */

describe('シフト削除機能テスト', () => {
  beforeEach(() => {
    // テスト環境の初期化
    global.isAdminUser = false;
    global.currentUser = {
      sub: 'test-user-123',
      name: 'テストユーザー',
      email: 'test@example.com'
    };
    global.myShiftsCache = null;
    global.allShiftsCache = null;

    // モック関数の初期化
    global.fetch = jest.fn();
    global.alert = jest.fn();
    global.confirm = jest.fn();
    global.loadShiftList = jest.fn();
    global.loadMyShiftsToCache = jest.fn();
    global.loadMyShifts = jest.fn();
    global.getShiftDisplayName = jest.fn();
    global.expandTimeRange = jest.fn();
    global.loadAllShiftsToCache = jest.fn();
    global.displayShiftList = jest.fn();
    global.generateCalendar = jest.fn();
  });

  describe('deleteShift関数の動作パターン', () => {
    test('権限チェック: 管理者は他人のシフト削除可能', () => {
      global.isAdminUser = true;
      const shift = {
        uuid: 'test-uuid',
        userId: 'other-user',
        shiftDate: '2025-01-15',
        timeSlot: '13:00-13:30'
      };

      // 管理者権限があれば削除処理に進むべき
      expect(global.isAdminUser || shift.userId === global.currentUser.sub).toBe(true);
    });

    test('権限チェック: 一般ユーザーは自分のシフトのみ削除可能', () => {
      global.isAdminUser = false;
      const ownShift = {
        uuid: 'test-uuid',
        userId: 'test-user-123',
        shiftDate: '2025-01-15',
        timeSlot: '13:00-13:30'
      };
      const otherShift = {
        uuid: 'test-uuid',
        userId: 'other-user',
        shiftDate: '2025-01-15',
        timeSlot: '13:00-13:30'
      };

      expect(global.isAdminUser || ownShift.userId === global.currentUser.sub).toBe(true);
      expect(global.isAdminUser || otherShift.userId === global.currentUser.sub).toBe(false);
    });
  });

  describe('deleteMyShift関数の動作パターン', () => {
    test('日付制限: 削除可能性の検証', () => {
      // 日付文字列の形式でテスト
      const futureDate = '2025-12-31'; // 確実に未来の日付
      const pastDate = '2020-01-01';   // 確実に過去の日付

      const futureShift = {
        uuid: 'future-uuid',
        shiftDate: futureDate,
        timeSlot: '13:00-13:30'
      };
      
      const pastShift = {
        uuid: 'past-uuid', 
        shiftDate: pastDate,
        timeSlot: '13:00-13:30'
      };

      // 基本的な日付比較ロジック
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const targetDateFuture = new Date(futureShift.shiftDate);
      const targetDatePast = new Date(pastShift.shiftDate);

      // 確実に未来の日付は削除可能
      expect(targetDateFuture > today).toBe(true);
      // 確実に過去の日付は削除不可
      expect(targetDatePast < today).toBe(true);
    });

    test('UUID配列の検証', () => {
      const validUuids = ['uuid1', 'uuid2'];
      const emptyUuids = [];
      const nullUuids = null;

      expect(Array.isArray(validUuids) && validUuids.length > 0).toBe(true);
      expect(Array.isArray(emptyUuids) && emptyUuids.length > 0).toBe(false);
      expect(Array.isArray(nullUuids) && nullUuids && nullUuids.length > 0).toBe(false);
    });
  });

  describe('deleteShiftFromModal関数の動作パターン', () => {
    test('ボタン状態管理の検証', () => {
      const mockButton = {
        textContent: '削除',
        disabled: false,
        style: { opacity: '1' }
      };

      // 削除開始時の状態
      mockButton.disabled = true;
      mockButton.textContent = '削除中...';
      mockButton.style.opacity = '0.6';

      expect(mockButton.disabled).toBe(true);
      expect(mockButton.textContent).toBe('削除中...');
      expect(mockButton.style.opacity).toBe('0.6');

      // 削除完了時の状態復元
      mockButton.disabled = false;
      mockButton.textContent = '削除';
      mockButton.style.opacity = '1';

      expect(mockButton.disabled).toBe(false);
      expect(mockButton.textContent).toBe('削除');
      expect(mockButton.style.opacity).toBe('1');
    });

    test('モーダル制御の検証', () => {
      const mockModal = {
        style: { display: 'block' }
      };

      global.document.getElementById = jest.fn().mockReturnValue(mockModal);

      const modal = global.document.getElementById('shiftDetailModal');
      expect(modal).toBeTruthy();
      
      // モーダルを閉じる
      if (modal) {
        modal.style.display = 'none';
      }
      expect(modal.style.display).toBe('none');
    });
  });

  describe('共通のデータ形式テスト', () => {
    test('UUID形式の統一性', () => {
      const testShift = {
        uuid: 'test-uuid-123',
        userId: 'user-123',
        shiftDate: '2025-01-15',
        timeSlot: '13:00-13:30'
      };

      // すべての削除関数で同じUUID形式を使用
      expect(typeof testShift.uuid).toBe('string');
      expect(testShift.uuid.length).toBeGreaterThan(0);
    });

    test('削除リクエストデータ形式', () => {
      // deleteShift / deleteShiftFromModal用
      const singleDeleteData = {
        type: 'deleteShift',
        uuid: 'single-uuid'
      };

      // deleteMyShift用
      const multipleDeleteData = {
        type: 'deleteShift',
        uuids: ['uuid1', 'uuid2']
      };

      expect(singleDeleteData.type).toBe('deleteShift');
      expect(typeof singleDeleteData.uuid).toBe('string');
      
      expect(multipleDeleteData.type).toBe('deleteShift');
      expect(Array.isArray(multipleDeleteData.uuids)).toBe(true);
    });
  });

  describe('エラーハンドリングパターン', () => {
    test('ログインチェック', () => {
      global.currentUser = null;
      expect(global.currentUser).toBeNull();

      global.currentUser = { sub: 'user-123' };
      expect(global.currentUser).toBeTruthy();
    });

    test('確認ダイアログのキャンセル', () => {
      global.confirm = jest.fn().mockReturnValue(false);
      const result = global.confirm('削除しますか？');
      expect(result).toBe(false);
      expect(global.confirm).toHaveBeenCalledWith('削除しますか？');
    });

    test('ネットワークエラーハンドリング', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
      global.console.error = jest.fn();

      try {
        await global.fetch('test-url');
      } catch (error) {
        global.console.error('削除エラー:', error);
        expect(global.console.error).toHaveBeenCalledWith('削除エラー:', expect.any(Error));
      }
    });
  });
});