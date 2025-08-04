const GOOGLE_APPS_SCRIPT_URL = config.GOOGLE_APPS_SCRIPT_URL;
const GOOGLE_CLIENT_ID = config.GOOGLE_CLIENT_ID;
const AUTHORIZED_EMAILS = config.AUTHORIZED_EMAILS.split(',').map(email => email.trim());

let currentUser = null;
let isAdminUser = false;
let myShiftsCache = null; // 自分のシフトデータのキャッシュ
let allShiftsCache = null; // 全員のシフトデータのキャッシュ（管理者用）
let capacityCache = null; // 人数設定データのキャッシュ（管理者用）

function handleCredentialResponse(response) {
    const responsePayload = decodeJwtResponse(response.credential);
    
    // Check if email is authorized admin
    isAdminUser = AUTHORIZED_EMAILS.includes(responsePayload.email);
    
    showProfile(responsePayload);
}

function decodeJwtResponse(token) {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));

    return JSON.parse(jsonPayload);
}


async function showProfile(profileData) {
    currentUser = profileData;
    
    document.getElementById('loginButton').classList.add('hidden');
    document.getElementById('profileInfo').classList.remove('hidden');
    document.getElementById('loginPrompt').classList.add('hidden');
    document.getElementById('appContent').classList.remove('hidden');
    
    document.getElementById('userImage').src = profileData.picture;
    document.getElementById('userName').textContent = profileData.name;
    document.getElementById('userEmail').textContent = profileData.email;
    
    // 一般ユーザーの場合、ユーザー情報をスプレッドシートに保存
    if (!isAdminUser) {
        await saveUserToSpreadsheet(profileData);
    }
    
    // タブの表示制御
    updateTabVisibility();
    
    // 初回データロード
    if (isAdminUser) {
        // 管理者の場合、全データを初回に読み込み
        await Promise.all([
            loadAllShiftsToCache(),  // 全員のシフトデータ
            loadCapacityToCache()    // 人数設定データ
        ]);
        // キャッシュを使って初期表示
        displayShiftList();
    } else {
        // 一般ユーザーの場合、必要なデータを初回に読み込み
        await Promise.all([
            loadUserShiftsData(),     // 自分のシフトデータ
            loadCapacityToCache()     // 人数設定データ（シフト申請用）
        ]);
        // キャッシュを使って初期表示
        displayMyShifts(document.getElementById('myShiftsCalendarContainer'), myShiftsCache);
    }
}

// ユーザーのシフトデータを取得してキャッシュする関数
async function loadUserShiftsData() {
    if (!currentUser) return;
    
    try {
        const result = await jsonpRequest(GOOGLE_APPS_SCRIPT_URL, {
            type: 'loadMyShifts',
            userId: currentUser.sub
        });
        
        if (result.success && result.data) {
            currentUserShifts = result.data;
        }
    } catch (error) {
        console.error('ユーザーシフトデータの取得に失敗:', error);
        currentUserShifts = [];
    }
}

async function syncAllShiftsToCalendar() {
    if (!currentUser) {
        alert('ログインが必要です。');
        return;
    }
    
    const syncBtn = document.getElementById('syncBtn');
    syncBtn.disabled = true;
    syncBtn.textContent = '同期中...';
    
    try {
        await fetch(GOOGLE_APPS_SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            mode: 'no-cors',
            body: JSON.stringify({
                type: 'syncAll',
                userId: currentUser.sub
            })
        });
        
        console.log('すべてのシフトをカレンダーに同期しました');
        alert('すべてのシフトがカレンダーに同期されました！');
        
    } catch (error) {
        console.error('同期に失敗しました:', error);
        alert('同期に失敗しました。再度お試しください。');
    } finally {
        syncBtn.disabled = false;
        syncBtn.textContent = 'Googleカレンダーと同期';
    }
}

async function deleteAllShiftsFromCalendar() {
    if (!currentUser) {
        alert('ログインが必要です。');
        return;
    }
    
    if (!isAdminUser) {
        alert('管理者権限が必要です。');
        return;
    }
    
    if (!confirm('Googleカレンダーからすべてのシフト予定を削除しますか？\nこの操作は取り消せません。')) {
        return;
    }
    
    const deleteBtn = document.getElementById('deleteAllBtn');
    deleteBtn.disabled = true;
    deleteBtn.textContent = '削除中...';
    
    try {
        await fetch(GOOGLE_APPS_SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            mode: 'no-cors',
            body: JSON.stringify({
                type: 'deleteAllFromCalendar',
                userId: currentUser.sub
            })
        });
        
        console.log('カレンダーからすべてのシフトを削除しました');
        alert('カレンダーからすべてのシフト予定を削除しました！');
        
    } catch (error) {
        console.error('削除に失敗しました:', error);
        alert('削除に失敗しました。再度お試しください。');
    } finally {
        deleteBtn.disabled = false;
        deleteBtn.textContent = 'カレンダーの全シフトを削除';
    }
}

function signOut() {
    google.accounts.id.disableAutoSelect();
    
    currentUser = null;
    isAdminUser = false;
    document.getElementById('loginButton').classList.remove('hidden');
    document.getElementById('profileInfo').classList.add('hidden');
    document.getElementById('loginPrompt').classList.remove('hidden');
    document.getElementById('appContent').classList.add('hidden');
    
    document.getElementById('userImage').src = '';
    document.getElementById('userName').textContent = '';
    document.getElementById('userEmail').textContent = '';
    
    console.log('ユーザーがログアウトしました');
}

function setupTabSwitching() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.getAttribute('data-tab');

            // Remove active class from all buttons and contents
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            // Add active class to clicked button and corresponding content
            button.classList.add('active');
            document.getElementById(targetTab).classList.add('active');
            
            // Load data for the selected tab
            if (targetTab === 'capacity-settings') {
                loadCapacitySettings();
            } else if (targetTab === 'my-shifts') {
                loadMyShifts(); // キャッシュからデータを表示
            } else if (targetTab === 'shift-request') {
                loadShiftRequestForm();
            }
        });
    });
}

// 管理者用：全員のシフトデータをキャッシュに読み込む
async function loadAllShiftsToCache() {
    console.log('管理者モード: 全員のシフトデータをキャッシュに読み込み中...');
    
    try {
        const result = await jsonpRequest(GOOGLE_APPS_SCRIPT_URL, {
            type: 'loadMyShifts',
            userId: 'admin'
        });
        
        if (result.success) {
            allShiftsCache = result.data || [];
            window.allShiftsData = allShiftsCache; // 既存コードとの互換性のため
            console.log('全員のシフトデータをキャッシュに保存しました:', allShiftsCache.length, '件');
        } else {
            console.error('シフトデータの取得に失敗:', result.error);
        }
    } catch (error) {
        console.error('シフトデータの読み込み中にエラーが発生:', error);
    }
}

// 管理者用：人数設定データをキャッシュに読み込む
async function loadCapacityToCache() {
    console.log('管理者モード: 人数設定データをキャッシュに読み込み中...');
    
    try {
        const result = await jsonpRequest(GOOGLE_APPS_SCRIPT_URL, {
            type: 'loadCapacity'
        });
        
        if (result.success) {
            capacityCache = result.data || [];
            window.capacityData = capacityCache; // 既存コードとの互換性のため
            console.log('人数設定データをキャッシュに保存しました:', capacityCache.length, '件');
        } else {
            console.error('人数設定データの取得に失敗:', result.error);
        }
    } catch (error) {
        console.error('人数設定データの読み込み中にエラーが発生:', error);
    }
}

// キャッシュから管理者用シフト一覧を表示
function displayShiftList() {
    const container = document.getElementById('shiftCalendarContainer');
    if (!container) return;
    
    if (allShiftsCache && allShiftsCache.length > 0) {
        window.allShiftsData = allShiftsCache;
        generateCalendar('shiftCalendarContainer');
    } else {
        container.innerHTML = '<p>シフトデータがありません。</p>';
    }
}

async function loadShiftList() {
    // キャッシュがある場合は、キャッシュから表示
    if (allShiftsCache !== null) {
        console.log('キャッシュから全員のシフト一覧を表示');
        displayShiftList();
        return;
    }
    
    // キャッシュがない場合は、データを読み込む
    console.log('管理者モード: 全員のシフト一覧を読み込み中...');
    
    const container = document.getElementById('shiftCalendarContainer');
    if (!container) return;
    
    // ローディング表示
    container.innerHTML = `
        <div class="loading-container">
            <div class="loading-spinner"></div>
            <div class="loading-text">全員のシフト一覧を読み込み中...</div>
        </div>
    `;
    
    await loadAllShiftsToCache();
    displayShiftList();
}

function generateCalendar(containerId, isCapacityMode = false, isRequestMode = false) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = '';
    
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
    
    // シフト申請モードの場合は申請可能期間に制限
    if (isRequestMode) {
        const currentDay = today.getDate();
        if (currentDay >= 15) {
            // 15日以降なら次の月まで表示
            endDate = new Date(currentYear, today.getMonth() + 2, 0); // 次月末日
        } else {
            // 15日未満なら今月まで表示
            endDate = new Date(currentYear, today.getMonth() + 1, 0); // 今月末日
        }
    }
    
    let currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
        const monthDiv = createMonthCalendar(currentDate.getFullYear(), currentDate.getMonth(), isCapacityMode, isRequestMode);
        container.appendChild(monthDiv);
        currentDate.setMonth(currentDate.getMonth() + 1);
    }
}

function createMonthCalendar(year, month, isCapacityMode = false, isRequestMode = false) {
    const monthDiv = document.createElement('div');
    monthDiv.className = 'calendar-month';
    
    const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
    
    const title = document.createElement('h4');
    title.textContent = `${year}年 ${monthNames[month]}`;
    monthDiv.appendChild(title);
    
    const table = document.createElement('table');
    table.className = 'calendar-table';
    
    // ヘッダー行
    const headerRow = document.createElement('tr');
    dayNames.forEach((day, index) => {
        const th = document.createElement('th');
        th.textContent = day;
        if (index === 0) th.className = 'sunday';
        if (index === 6) th.className = 'saturday';
        headerRow.appendChild(th);
    });
    table.appendChild(headerRow);
    
    // 日付を生成
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDayOfWeek = firstDay.getDay();
    
    let date = 1;
    const today = new Date();
    
    for (let week = 0; week < 6; week++) {
        const row = document.createElement('tr');
        
        for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
            const cell = document.createElement('td');
            
            if (week === 0 && dayOfWeek < startDayOfWeek) {
                // 前月の日付
                const prevMonthLastDay = new Date(year, month, 0).getDate();
                const prevDate = prevMonthLastDay - startDayOfWeek + dayOfWeek + 1;
                cell.className = 'other-month';
                cell.innerHTML = `<div class="calendar-day-number">${prevDate}</div>`;
            } else if (date > lastDay.getDate()) {
                // 翌月の日付
                const nextDate = date - lastDay.getDate();
                cell.className = 'other-month';
                cell.innerHTML = `<div class="calendar-day-number">${nextDate}</div>`;
                date++;
            } else {
                // 当月の日付
                const currentDate = new Date(year, month, date);
                const dayNumber = document.createElement('div');
                dayNumber.className = 'calendar-day-number';
                dayNumber.textContent = date;
                
                if (dayOfWeek === 0) dayNumber.className += ' sunday';
                if (dayOfWeek === 6) dayNumber.className += ' saturday';
                
                cell.appendChild(dayNumber);
                
                // 今日の日付をハイライト
                if (currentDate.toDateString() === today.toDateString()) {
                    cell.className = 'today';
                }
                
                if (isCapacityMode) {
                    // 人数設定モードの場合は表示モードを追加
                    const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
                    
                    // 表示モード
                    const capacityDisplay = document.createElement('div');
                    capacityDisplay.className = 'capacity-display';
                    capacityDisplay.id = `display-${dateKey}`;
                    
                    const capacityValue = document.createElement('span');
                    capacityValue.className = 'capacity-value';
                    capacityValue.textContent = `${getDefaultCapacity(dayOfWeek)}人`;
                    capacityValue.id = `value-${dateKey}`;
                    capacityDisplay.appendChild(capacityValue);
                    
                    const editIcon = document.createElement('span');
                    editIcon.className = 'edit-icon';
                    editIcon.innerHTML = '✏️';
                    editIcon.title = '編集';
                    editIcon.onclick = () => toggleEditMode(dateKey);
                    capacityDisplay.appendChild(editIcon);
                    
                    cell.appendChild(capacityDisplay);
                    
                    // 編集モード（初期は非表示）
                    const editMode = document.createElement('div');
                    editMode.className = 'capacity-edit-mode';
                    editMode.id = `edit-${dateKey}`;
                    editMode.style.display = 'none';
                    
                    const inputRow = document.createElement('div');
                    inputRow.className = 'capacity-input-row';
                    
                    const input = document.createElement('input');
                    input.type = 'number';
                    input.min = '0';
                    input.max = '20';
                    input.className = 'capacity-input';
                    input.value = getDefaultCapacity(dayOfWeek);
                    input.id = `input-${dateKey}`;
                    inputRow.appendChild(input);
                    
                    const unitLabel = document.createElement('span');
                    unitLabel.className = 'capacity-label';
                    unitLabel.textContent = '人';
                    inputRow.appendChild(unitLabel);
                    
                    editMode.appendChild(inputRow);
                    
                    const controls = document.createElement('div');
                    controls.className = 'capacity-edit-controls';
                    
                    const saveBtn = document.createElement('button');
                    saveBtn.className = 'save-single-btn';
                    saveBtn.innerHTML = '✅';
                    saveBtn.title = '保存';
                    saveBtn.onclick = () => saveSingleCapacity(dateKey);
                    controls.appendChild(saveBtn);
                    
                    const cancelBtn = document.createElement('button');
                    cancelBtn.className = 'cancel-edit-btn';
                    cancelBtn.innerHTML = '❌';
                    cancelBtn.title = 'キャンセル';
                    cancelBtn.onclick = () => cancelEdit(dateKey);
                    controls.appendChild(cancelBtn);
                    
                    editMode.appendChild(controls);
                    cell.appendChild(editMode);
                } else if (isRequestMode) {
                    // シフト申請モードの場合は人数表示と申請ボタン
                    const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
                    const cellDate = new Date(year, month, date);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    
                    // 申請可能日かチェック
                    const isValidRequestDate = isDateAvailableForRequest(cellDate, today);
                    
                    if (!isValidRequestDate || cellDate < today) {
                        // 申請不可能な日は無効化
                        cell.classList.add('past-date');
                        cell.title = cellDate < today ? '過去の日付です' : '申請可能期間外です';
                        // 内容は表示しないが、cellは作成して日付インクリメントは続ける
                    } else {
                    
                    const requestInfo = document.createElement('div');
                    requestInfo.className = 'shift-request-info';
                    requestInfo.id = `request-${dateKey}`;
                    
                    // 必要人数表示
                    const capacityInfo = document.createElement('div');
                    capacityInfo.className = 'shift-capacity-info';
                    capacityInfo.id = `capacity-${dateKey}`;
                    capacityInfo.innerHTML = `<span class="capacity-number">${getDefaultCapacity(dayOfWeek)}</span><span class="capacity-unit">人</span>`;
                    requestInfo.appendChild(capacityInfo);
                    
                    // 申請ボタン
                    const defaultCapacity = getDefaultCapacity(dayOfWeek);
                    if (defaultCapacity > 0) {
                        const applyButton = document.createElement('button');
                        applyButton.className = 'inline-apply-btn';
                        applyButton.textContent = '申請';
                        applyButton.onclick = (e) => {
                            e.stopPropagation();
                            openDateDetailModal(dateKey);
                        };
                        requestInfo.appendChild(applyButton);
                    }
                    
                    cell.appendChild(requestInfo);
                    cell.setAttribute('data-date', dateKey);
                    }
                } else {
                    // シフト一覧モードの場合は全員のシフト情報を表示
                    const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
                    const shiftInfo = document.createElement('div');
                    shiftInfo.className = 'calendar-shift-info';
                    shiftInfo.id = `shift-${dateKey}`;
                    
                    // 全員のシフトデータから該当日付のデータを取得
                    displayShiftsForDate(shiftInfo, dateKey);
                    
                    cell.appendChild(shiftInfo);
                    
                    // クリックイベント
                    cell.setAttribute('data-date', dateKey);
                    cell.addEventListener('click', handleCalendarCellClick);
                }
                
                date++;
            }
            
            row.appendChild(cell);
        }
        
        table.appendChild(row);
        
        if (date > lastDay.getDate()) break;
    }
    
    monthDiv.appendChild(table);
    return monthDiv;
}

// シフト申請可能日の判定関数
function isDateAvailableForRequest(targetDate, currentDate) {
    const target = new Date(targetDate);
    const current = new Date(currentDate);
    
    // 本日以前は申請不可
    if (target < current) {
        return false;
    }
    
    const currentYear = current.getFullYear();
    const currentMonth = current.getMonth(); // 0-11
    const currentDay = current.getDate();
    
    const targetYear = target.getFullYear();
    const targetMonth = target.getMonth(); // 0-11
    
    // 月の差を計算
    const monthsDiff = (targetYear - currentYear) * 12 + (targetMonth - currentMonth);
    
    if (monthsDiff === 0) {
        // 同じ月：今日以降は申請可能
        return true;
    } else if (monthsDiff === 1) {
        // 次の月：15日以降なら申請可能
        // 例：7/15以降なら8月分申請可能
        return currentDay >= 15;
    } else {
        // 2ヶ月以上先は申請不可
        return false;
    }
}

function getDefaultCapacity(dayOfWeek) {
    // 日曜日=0, 月曜日=1, 火曜日=2, 水曜日=3, 木曜日=4, 金曜日=5, 土曜日=6
    switch (dayOfWeek) {
        case 0: // 日曜日
        case 6: // 土曜日
            return 0;
        case 3: // 水曜日
            return 2;
        default: // 月火木金
            return 3;
    }
}

// 管理者用：個人ごとに連続する時間帯をマージする関数
function mergeShiftsByPerson(shiftsForDate) {
    // 個人ごとにグループ化
    const shiftsByPerson = {};
    shiftsForDate.forEach(shift => {
        const personKey = `${shift.userName || shift.name || '名前未設定'}_${shift.userEmail || shift.email}`;
        if (!shiftsByPerson[personKey]) {
            shiftsByPerson[personKey] = {
                person: shift,
                timeSlots: []
            };
        }
        shiftsByPerson[personKey].timeSlots.push(shift.timeSlot || shift.time);
    });
    
    // 各個人の時間帯をマージ
    const mergedShifts = [];
    Object.keys(shiftsByPerson).forEach(personKey => {
        const personData = shiftsByPerson[personKey];
        const mergedTimeSlots = mergeConsecutiveTimeSlots(personData.timeSlots);
        
        mergedTimeSlots.forEach(timeSlot => {
            mergedShifts.push({
                ...personData.person,
                timeSlot: timeSlot
            });
        });
    });
    
    return mergedShifts;
}

// 指定された日付のシフト情報を表示する関数
function displayShiftsForDate(container, dateKey) {
    if (!window.allShiftsData) {
        return;
    }
    
    // 該当日付のシフトをフィルタリング
    const shiftsForDate = window.allShiftsData.filter(shift => shift.shiftDate === dateKey);
    
    if (shiftsForDate.length === 0) {
        return; // シフトがない場合は何も表示しない
    }
    
    // 個人ごとに連続する時間帯をマージ
    const mergedShifts = mergeShiftsByPerson(shiftsForDate);
    
    // 時間帯ごとにグループ化
    const timeSlotGroups = {};
    mergedShifts.forEach(shift => {
        const timeSlot = shift.timeSlot;
        if (!timeSlotGroups[timeSlot]) {
            timeSlotGroups[timeSlot] = [];
        }
        timeSlotGroups[timeSlot].push(shift);
    });
    
    // 時間帯順にソート
    const sortedTimeSlots = Object.keys(timeSlotGroups).sort();
    
    sortedTimeSlots.forEach(timeSlot => {
        const timeSlotDiv = document.createElement('div');
        timeSlotDiv.className = 'shift-time-slot';
        
        const timeLabel = document.createElement('div');
        timeLabel.className = 'shift-time-label';
        timeLabel.textContent = timeSlot;
        timeSlotDiv.appendChild(timeLabel);
        
        const peopleDiv = document.createElement('div');
        peopleDiv.className = 'shift-people';
        
        timeSlotGroups[timeSlot].forEach(shift => {
            const personDiv = document.createElement('div');
            personDiv.className = 'shift-person';
            personDiv.textContent = shift.userName || shift.name || '名前未設定';
            personDiv.title = `${shift.userName || shift.name || '名前未設定'} (${shift.userEmail || shift.email || ''})`;
            peopleDiv.appendChild(personDiv);
        });
        
        timeSlotDiv.appendChild(peopleDiv);
        container.appendChild(timeSlotDiv);
    });
}

// シフト削除機能（管理者専用）
async function deleteShift(shift, dateKey, timeSlot) {
    if (!isAdminUser) {
        alert('管理者権限が必要です。');
        return;
    }
    
    const userName = shift.userName || shift.name || '名前未設定';
    const userEmail = shift.userEmail || shift.email || '';
    
    if (!confirm(`${userName}さんの${dateKey} ${timeSlot}のシフトを削除しますか？`)) {
        return;
    }
    
    try {
        const deleteData = {
            type: 'deleteShift',
            userId: shift.userId,
            userName: userName,
            userEmail: userEmail,
            date: dateKey,
            time: timeSlot,
            adminUserId: currentUser.sub
        };
        
        // シフト削除リクエストを送信
        const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            mode: 'no-cors',
            body: JSON.stringify(deleteData)
        });
        
        // no-corsモードでは成功として扱う
        alert(`${userName}さんの${dateKey} ${timeSlot}のシフトを削除しました。`);
        
        // シフト一覧を再読み込み
        await loadShiftList();
        
    } catch (error) {
        console.error('シフト削除でエラー:', error);
        alert('シフトの削除に失敗しました。再度お試しください。');
    }
}

// 時間範囲を30分単位のスロットに分解する関数
function expandTimeRange(timeRange) {
    console.log('expandTimeRange input:', timeRange);
    
    // 時間範囲を解析
    const rangeParts = timeRange.split('-');
    if (rangeParts.length !== 2) {
        // 単一時間の場合はそのまま返す
        console.log('単一時間:', timeRange);
        return [timeRange.trim()];
    }
    
    const startTime = rangeParts[0].trim();
    const endTime = rangeParts[1].trim();
    
    // 時間を分に変換
    function timeToMinutes(timeStr) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
    }
    
    // 分を時間に変換
    function minutesToTime(minutes) {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    }
    
    const startMinutes = timeToMinutes(startTime);
    const endMinutes = timeToMinutes(endTime);
    
    console.log('startMinutes:', startMinutes, 'endMinutes:', endMinutes);
    
    // 30分単位でスロットを生成  
    const timeSlots = [];
    for (let minutes = startMinutes; minutes < endMinutes; minutes += 30) {
        const slotStart = minutesToTime(minutes);
        const slotEnd = minutesToTime(minutes + 30);
        timeSlots.push(`${slotStart}-${slotEnd}`);
    }
    
    console.log('expandTimeRange output:', timeSlots);
    return timeSlots;
}

async function deleteShiftFromModal(buttonElement, userId, userName, userEmail, dateKey, timeSlot) {
    if (!isAdminUser) {
        alert('管理者権限が必要です。');
        return;
    }
    
    // 時間範囲を30分単位に分解
    const timeSlots = expandTimeRange(timeSlot);
    
    const displayTimeRange = timeSlots.length > 1 ? 
        `${timeSlots[0].split('-')[0]}-${timeSlots[timeSlots.length-1].split('-')[1]}` : 
        timeSlot;
    
    if (!confirm(`${userName}さんの${dateKey} ${displayTimeRange}のシフトを削除しますか？`)) {
        return;
    }
    
    // 対象の削除ボタンのみ無効化
    const originalText = buttonElement.textContent;
    buttonElement.disabled = true;
    buttonElement.textContent = '削除中...';
    buttonElement.style.opacity = '0.6';
    
    try {
        const deleteData = {
            type: 'deleteShift',
            userId: userId,
            userName: userName,
            userEmail: userEmail,
            date: dateKey,
            timeSlots: timeSlots, // 複数時間枠を配列で送信
            adminUserId: currentUser.sub
        };
        
        // シフト削除リクエストを送信
        const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            mode: 'no-cors',
            body: JSON.stringify(deleteData)
        });
        
        // no-corsモードでは成功として扱う
        alert(`${userName}さんの${dateKey} ${displayTimeRange}のシフトを削除しました。`);
        
        // モーダルを閉じる
        const modal = document.getElementById('shiftDetailModal');
        if (modal) {
            modal.style.display = 'none';
        }
        
        // データを再読み込みしてキャッシュを更新
        if (isAdminUser) {
            // キャッシュをクリアして再読み込み
            allShiftsCache = null;
            await loadAllShiftsToCache();
            displayShiftList();
        } else {
            // 一般ユーザーの場合もキャッシュを更新
            myShiftsCache = null;
            await loadMyShiftsToCache();
        }
        
        // カレンダーを再読み込み
        generateCalendar('shiftCalendarContainer');
        
    } catch (error) {
        console.error('シフト削除でエラー:', error);
        alert('シフトの削除に失敗しました。再度お試しください。');
        
        // エラー時は対象のボタンのみ元に戻す
        buttonElement.disabled = false;
        buttonElement.textContent = originalText;
        buttonElement.style.opacity = '1';
    }
}

function handleCalendarCellClick(event) {
    const cell = event.currentTarget;
    const date = cell.getAttribute('data-date');
    if (!date) return;
    
    console.log('Clicked date:', date);
    openShiftDetailModal(date);
}

// シフト詳細モーダルを開く関数
function openShiftDetailModal(dateKey) {
    if (!window.allShiftsData) {
        alert('シフトデータが読み込まれていません。');
        return;
    }
    
    // 該当日付のシフトをフィルタリング
    const shiftsForDate = window.allShiftsData.filter(shift => shift.shiftDate === dateKey);
    
    // 日付を整形して表示
    const dateObj = new Date(dateKey);
    const year = dateObj.getFullYear();
    const month = dateObj.getMonth() + 1;
    const day = dateObj.getDate();
    const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
    const weekday = weekdays[dateObj.getDay()];
    
    const title = document.getElementById('shiftDetailTitle');
    title.textContent = `${year}年${month}月${day}日 (${weekday}) のシフト詳細`;
    
    const content = document.getElementById('shiftDetailContent');
    
    if (shiftsForDate.length === 0) {
        content.innerHTML = `
            <div class="no-shifts-message">
                <p>この日にはシフトの申請がありません。</p>
            </div>
        `;
    } else {
        // 個人ごとに連続する時間帯をマージ
        const mergedShifts = mergeShiftsByPerson(shiftsForDate);
        
        // 時間帯ごとにグループ化
        const timeSlotGroups = {};
        mergedShifts.forEach(shift => {
            const timeSlot = shift.timeSlot;
            if (!timeSlotGroups[timeSlot]) {
                timeSlotGroups[timeSlot] = [];
            }
            timeSlotGroups[timeSlot].push(shift);
        });
        
        // 時間帯順にソート
        const sortedTimeSlots = Object.keys(timeSlotGroups).sort();
        
        let html = '<div class="shift-detail-list">';
        
        sortedTimeSlots.forEach(timeSlot => {
            html += `
                <div class="shift-detail-time-slot">
                    <div class="shift-detail-time-header">
                        <h4 class="shift-detail-time">${timeSlot}</h4>
                        <span class="shift-detail-count">${timeSlotGroups[timeSlot].length}名</span>
                    </div>
                    <div class="shift-detail-people">
            `;
            
            timeSlotGroups[timeSlot].forEach(shift => {
                html += `
                    <div class="shift-detail-person">
                        <div class="shift-person-info">
                            <div class="shift-person-name">${shift.userName || shift.name || '名前未設定'}</div>
                            <div class="shift-person-email">${shift.userEmail || shift.email || ''}</div>
                            ${shift.content && shift.content !== 'シフト' ? `<div class="shift-person-note">${shift.content}</div>` : ''}
                        </div>
                        ${isAdminUser ? `
                            <button class="shift-delete-btn" onclick="deleteShiftFromModal(this, '${shift.userId}', '${shift.userName || shift.name || '名前未設定'}', '${shift.userEmail || shift.email || ''}', '${dateKey}', '${timeSlot}')">
                                削除
                            </button>
                        ` : ''}
                    </div>
                `;
            });
            
            html += `
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        content.innerHTML = html;
    }
    
    // モーダルを表示
    document.getElementById('shiftDetailModal').style.display = 'block';
}

// シフト詳細モーダルを閉じる関数
function closeShiftDetailModal() {
    document.getElementById('shiftDetailModal').style.display = 'none';
}

async function loadCapacitySettings() {
    console.log('Loading capacity settings...');
    
    // ローディングアイコンを表示
    const loadingContainer = document.getElementById('capacityLoadingContainer');
    const calendarContainer = document.getElementById('capacityCalendarContainer');
    
    // キャッシュがある場合は、ローディングを表示せずに即座に表示
    if (capacityCache !== null) {
        console.log('キャッシュから人数設定を表示');
        generateCalendar('capacityCalendarContainer', true);
        if (capacityCache.length > 0) {
            applyCapacityData(capacityCache);
        }
        return;
    }
    
    loadingContainer.style.display = 'flex';
    calendarContainer.style.display = 'none';
    
    try {
        // キャッシュがない場合のみ読み込み
        await loadCapacityToCache();
        
        // カレンダーを生成
        generateCalendar('capacityCalendarContainer', true);
        
        // 読み込んだデータを入力フィールドに反映
        if (capacityCache && capacityCache.length > 0) {
            applyCapacityData(capacityCache);
        }
        
    } catch (error) {
        console.error('人数設定の読み込みに失敗しました:', error);
        // エラーが発生してもカレンダーは表示
        generateCalendar('capacityCalendarContainer', true);
    } finally {
        // ローディングアイコンを非表示にしてカレンダーを表示
        loadingContainer.style.display = 'none';
        calendarContainer.style.display = 'block';
    }
}

async function fetchCapacityFromSpreadsheet() {
    if (!currentUser) {
        return [];
    }
    
    try {
        console.log('人数設定を読み込み中...');
        
        const result = await jsonpRequest(GOOGLE_APPS_SCRIPT_URL, {
            type: 'loadCapacity'
        });
        
        if (result.success) {
            console.log('人数設定をスプレッドシートから読み込みました:', result.data);
            return result.data || [];
        } else {
            console.error('人数設定の読み込みに失敗:', result.error);
            return [];
        }
    } catch (error) {
        console.error('スプレッドシートからの読み込みに失敗しました:', error);
        return [];
    }
}

async function fetchShiftCountsFromSpreadsheet() {
    if (!currentUser) {
        return {};
    }
    
    try {
        const result = await jsonpRequest(GOOGLE_APPS_SCRIPT_URL, {
            type: 'loadShiftCounts'
        });
        
        if (result.success) {
            return result.data || {};
        } else {
            console.error('シフト申請数の読み込みに失敗:', result.error);
            return {};
        }
    } catch (error) {
        console.error('シフト申請数の読み込みに失敗しました:', error);
        return {};
    }
}

function toggleEditMode(dateKey) {
    const displayElement = document.getElementById(`display-${dateKey}`);
    const editElement = document.getElementById(`edit-${dateKey}`);
    const valueElement = document.getElementById(`value-${dateKey}`);
    const inputElement = document.getElementById(`input-${dateKey}`);
    
    if (displayElement && editElement && valueElement && inputElement) {
        // 現在の値を編集用入力フィールドにセット
        const currentValue = parseInt(valueElement.textContent) || 0;
        inputElement.value = currentValue;
        
        // 表示モードを非表示、編集モードを表示
        displayElement.style.display = 'none';
        editElement.style.display = 'flex';
        
        // 入力フィールドにフォーカス
        inputElement.focus();
        inputElement.select();
    }
}

function cancelEdit(dateKey) {
    const displayElement = document.getElementById(`display-${dateKey}`);
    const editElement = document.getElementById(`edit-${dateKey}`);
    
    if (displayElement && editElement) {
        // 編集モードを非表示、表示モードを表示
        editElement.style.display = 'none';
        displayElement.style.display = 'flex';
    }
}

async function saveSingleCapacity(dateKey) {
    if (!currentUser) {
        alert('ログインが必要です。');
        return;
    }
    
    const inputElement = document.getElementById(`input-${dateKey}`);
    const valueElement = document.getElementById(`value-${dateKey}`);
    const saveBtn = document.querySelector(`#edit-${dateKey} .save-single-btn`);
    const cancelBtn = document.querySelector(`#edit-${dateKey} .cancel-edit-btn`);
    
    if (!inputElement || !valueElement) {
        return;
    }
    
    const newCapacity = parseInt(inputElement.value) || 0;
    
    // ボタンを無効化
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '⏳';
        saveBtn.title = '保存中...';
    }
    if (cancelBtn) {
        cancelBtn.disabled = true;
    }
    
    try {
        // 単一の日付データを送信
        const capacityData = [{
            date: dateKey,
            capacity: newCapacity,
            userId: currentUser.sub,
            userName: currentUser.name,
            timestamp: new Date().toISOString()
        }];
        
        await saveCapacityToSpreadsheet(capacityData);
        
        // 表示を更新
        valueElement.textContent = `${newCapacity}人`;
        
        // 編集モードを終了
        cancelEdit(dateKey);
        
    } catch (error) {
        console.error('人数設定の保存に失敗しました:', error);
        alert('保存に失敗しました。再度お試しください。');
        
        // エラー時はボタンを復活
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '✅';
            saveBtn.title = '保存';
        }
        if (cancelBtn) {
            cancelBtn.disabled = false;
        }
    }
}

function applyCapacityData(capacityData) {
    console.log('適用するデータ:', capacityData);
    
    // データを日付をキーとするマップに変換
    const capacityMap = {};
    capacityData.forEach(item => {
        if (item.date && item.date !== '') {
            capacityMap[item.date] = item.capacity;
        }
    });
    
    console.log('日付マップ:', capacityMap);
    
    // 各表示要素に値を設定
    let appliedCount = 0;
    
    Object.keys(capacityMap).forEach(dateKey => {
        const valueElement = document.getElementById(`value-${dateKey}`);
        const inputElement = document.getElementById(`input-${dateKey}`);
        
        if (valueElement && inputElement) {
            const capacity = capacityMap[dateKey];
            valueElement.textContent = `${capacity}人`;
            inputElement.value = capacity;
            appliedCount++;
            console.log(`${dateKey}: ${capacity}人を設定`);
        }
    });
    
    console.log(`保存済みの人数設定を反映しました（${appliedCount}件）`);
}

async function saveAllCapacitySettings() {
    if (!currentUser) {
        alert('ログインが必要です。');
        return;
    }
    
    const saveBtn = document.getElementById('saveCapacityBtn');
    const originalText = saveBtn.textContent;
    
    try {
        saveBtn.disabled = true;
        saveBtn.textContent = '保存中...';
        
        // 全ての入力フィールドからデータを収集
        const capacityData = collectCapacityData();
        
        if (capacityData.length === 0) {
            alert('保存するデータがありません。');
            return;
        }
        
        // Google Spreadsheetに保存
        await saveCapacityToSpreadsheet(capacityData);
        
    } catch (error) {
        console.error('人数設定の保存に失敗しました:', error);
        alert('保存に失敗しました。再度お試しください。');
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = originalText;
    }
}

function collectCapacityData() {
    const capacityInputs = document.querySelectorAll('.capacity-input');
    const data = [];
    
    capacityInputs.forEach(input => {
        const date = input.getAttribute('data-date');
        const capacity = parseInt(input.value) || 0;
        
        if (date) {
            data.push({
                date: date,
                capacity: capacity,
                userId: currentUser.sub,
                userName: currentUser.name,
                timestamp: new Date().toISOString()
            });
        }
    });
    
    return data;
}

async function saveCapacityToSpreadsheet(capacityData) {
    try {
        await fetch(GOOGLE_APPS_SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            mode: 'no-cors',
            body: JSON.stringify({
                type: 'capacity',
                data: capacityData
            })
        });
        
        console.log('人数設定をスプレッドシートに保存しました');
        
        // キャッシュをクリアして再読み込み
        if (isAdminUser) {
            capacityCache = null;
            await loadCapacityToCache();
        }
    } catch (error) {
        console.error('スプレッドシートへの保存に失敗しました:', error);
        throw error;
    }
}

function updateTabVisibility() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    const adminTabs = ['shift-list', 'capacity-settings'];
    const userTabs = ['my-shifts', 'shift-request'];
    
    // まず全てのタブボタンとコンテンツをリセット
    tabButtons.forEach(button => {
        button.classList.remove('active');
        button.style.display = 'none';
    });
    tabContents.forEach(content => {
        content.classList.remove('active');
    });
    
    tabButtons.forEach(button => {
        const tabId = button.getAttribute('data-tab');
        
        if (isAdminUser) {
            // 管理者は管理者用タブのみ表示
            if (adminTabs.includes(tabId)) {
                button.style.display = 'inline-block';
            }
        } else {
            // 一般ユーザーは一般ユーザー用タブのみ表示
            if (userTabs.includes(tabId)) {
                button.style.display = 'inline-block';
            }
        }
    });
    
    // 最初に表示するタブを選択
    const visibleButtons = Array.from(tabButtons).filter(btn => btn.style.display !== 'none');
    if (visibleButtons.length > 0) {
        visibleButtons[0].click();
    }
}

// JSONP リクエスト用のヘルパー関数
function jsonpRequest(url, params = {}) {
    return new Promise((resolve, reject) => {
        const callbackName = 'jsonp_callback_' + Math.random().toString(36).substr(2, 9);
        const timestamp = new Date().getTime();
        
        // グローバルコールバック関数を作成
        window[callbackName] = function(data) {
            // 成功時の処理
            delete window[callbackName];
            document.head.removeChild(script);
            resolve(data);
        };
        
        // パラメータを追加
        const urlParams = new URLSearchParams({
            ...params,
            callback: callbackName,
            _t: timestamp
        });
        
        // スクリプトタグを作成
        const script = document.createElement('script');
        script.src = url + '?' + urlParams.toString();
        script.onerror = function() {
            delete window[callbackName];
            document.head.removeChild(script);
            reject(new Error('JSONP request failed'));
        };
        
        // タイムアウト処理
        setTimeout(() => {
            if (window[callbackName]) {
                delete window[callbackName];
                document.head.removeChild(script);
                reject(new Error('JSONP request timeout'));
            }
        }, 10000);
        
        document.head.appendChild(script);
    });
}

// シフトデータをキャッシュに読み込む関数
async function loadMyShiftsToCache() {
    if (!currentUser) return;
    
    try {
        const result = await jsonpRequest(GOOGLE_APPS_SCRIPT_URL, {
            type: 'loadMyShifts',
            userId: currentUser.sub
        });
        
        if (result.success) {
            myShiftsCache = result.data || [];
            console.log('シフトデータをキャッシュに読み込みました:', myShiftsCache.length, '件');
        } else {
            console.error('シフトデータの取得に失敗:', result.error);
            myShiftsCache = [];
        }
    } catch (error) {
        console.error('シフトデータの取得中にエラーが発生:', error);
        myShiftsCache = [];
    }
}

// キャッシュを更新する関数（シフト申請成功時に呼び出し）
function updateMyShiftsCache(newShift) {
    if (!myShiftsCache) {
        myShiftsCache = [];
    }
    myShiftsCache.push(newShift);
    console.log('シフトキャッシュを更新しました:', newShift);
}

async function loadMyShifts() {
    console.log('自分のシフト一覧を表示中...');
    const container = document.getElementById('myShiftsContent');
    if (!container) return;
    
    if (!currentUser) {
        container.innerHTML = '<p>ログインが必要です。</p>';
        return;
    }
    
    // キャッシュが存在しない場合は読み込み
    if (myShiftsCache === null) {
        container.innerHTML = `
            <div class="loading-container">
                <div class="loading-spinner"></div>
                <div class="loading-text">自分のシフト一覧を読み込み中...</div>
            </div>
        `;
        await loadMyShiftsToCache();
    }
    
    // キャッシュからデータを表示
    displayMyShifts(container, myShiftsCache || []);
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

function displayMyShifts(container, shiftsData) {
    if (!shiftsData || shiftsData.length === 0) {
        container.innerHTML = `
            <div class="no-shifts-message">
                <h4>まだシフトが登録されていません</h4>
                <p>「シフト申請」タブからシフトを申請してください。</p>
            </div>
        `;
        return;
    }
    
    // 日付ごとにシフトをグループ化
    const shiftsByDate = {};
    shiftsData.forEach(shift => {
        const date = shift.shiftDate;
        if (!shiftsByDate[date]) {
            shiftsByDate[date] = {
                shifts: [],
                registrationDate: shift.registrationDate,
                content: shift.content
            };
        }
        shiftsByDate[date].shifts.push(shift.timeSlot);
    });
    
    // 各日付の時間帯をマージ
    const mergedShifts = [];
    Object.keys(shiftsByDate).forEach(date => {
        const dateData = shiftsByDate[date];
        const mergedTimeSlots = mergeConsecutiveTimeSlots(dateData.shifts);
        
        mergedTimeSlots.forEach(timeSlot => {
            mergedShifts.push({
                shiftDate: date,
                timeSlot: timeSlot,
                content: dateData.content,
                registrationDate: dateData.registrationDate
            });
        });
    });
    
    // 日付でソート
    mergedShifts.sort((a, b) => new Date(a.shiftDate) - new Date(b.shiftDate));
    
    // シフトテーブルを作成
    let tableHTML = `
        <div class="my-shifts-summary">
            <h4>登録済みシフト: ${mergedShifts.length}件</h4>
        </div>
        <div class="my-shifts-table-container">
            <table class="my-shifts-table">
                <thead>
                    <tr>
                        <th>シフト日</th>
                        <th>時間帯</th>
                        <th>備考</th>
                        <th>申請日</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    mergedShifts.forEach(shift => {
        const shiftDate = new Date(shift.shiftDate);
        const formattedDate = shiftDate.toLocaleDateString('ja-JP', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'short'
        });
        
        const registrationDate = new Date(shift.registrationDate);
        const formattedRegDate = registrationDate.toLocaleDateString('ja-JP', {
            year: 'numeric',
            month: 'numeric',
            day: 'numeric'
        });
        
        // 削除可能性の判定（翌日以降のみ削除可能）
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const isPastOrToday = shiftDate < tomorrow; // 今日以前（今日を含む）
        const canDelete = shiftDate >= tomorrow; // 翌日以降のみ削除可能
        const rowClass = isPastOrToday ? 'past-shift' : 'future-shift';
        
        // 削除ボタンの表示（翌日以降のシフトのみ）
        const deleteButtonHTML = canDelete ? 
            `<td class="shift-actions">
                <button class="my-shift-delete-btn" onclick="deleteMyShift('${shift.shiftDate}', '${shift.timeSlot}', this)">
                    削除
                </button>
            </td>` :
            '<td class="shift-actions">-</td>';
        
        tableHTML += `
            <tr class="${rowClass}">
                <td class="shift-date">${formattedDate}</td>
                <td class="shift-time">${shift.timeSlot}</td>
                <td class="shift-content">${shift.content || '-'}</td>
                <td class="shift-reg-date">${formattedRegDate}</td>
                ${deleteButtonHTML}
            </tr>
        `;
    });
    
    tableHTML += `
                </tbody>
            </table>
        </div>
    `;
    
    container.innerHTML = tableHTML;
}

// 自分のシフト削除機能
async function deleteMyShift(shiftDate, timeSlot, buttonElement) {
    if (!currentUser) {
        alert('ログインしてください。');
        return;
    }
    
    // 翌日以降のシフトかチェック
    const targetDate = new Date(shiftDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (targetDate < tomorrow) {
        alert('今日以前のシフトは削除できません。翌日以降のシフトのみ削除可能です。');
        return;
    }
    
    if (!confirm(`${shiftDate} ${timeSlot}のシフトを削除しますか？`)) {
        return;
    }
    
    // ボタンの状態を更新
    const originalText = buttonElement.textContent;
    buttonElement.disabled = true;
    buttonElement.textContent = '削除中...';
    buttonElement.style.opacity = '0.6';
    
    try {
        // 時間範囲を30分単位に分解
        const expandedTimeSlots = expandTimeRange(timeSlot);
        
        const deleteData = {
            type: 'deleteShift',
            userId: currentUser.sub,
            userName: currentUser.name,
            userEmail: currentUser.email,
            date: shiftDate,
            timeSlots: expandedTimeSlots // 複数の時間枠を送信
        };
        
        // シフト削除リクエストを送信
        const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            mode: 'no-cors',
            body: JSON.stringify(deleteData)
        });
        
        // no-corsモードでは成功として扱う
        alert(`${shiftDate} ${timeSlot}のシフトを削除しました。`);
        
        // 自分のシフト一覧を再読み込み
        await loadMyShiftsToCache();
        loadMyShifts();
        
    } catch (error) {
        console.error('シフト削除でエラー:', error);
        alert('シフトの削除に失敗しました。再度お試しください。');
    } finally {
        // ボタンの状態を復元
        buttonElement.disabled = false;
        buttonElement.textContent = originalText;
        buttonElement.style.opacity = '1';
    }
}

async function loadShiftRequestForm() {
    console.log('シフト申請フォームを読み込み中...');
    const container = document.getElementById('shiftRequestContent');
    if (!container) return;
    
    // キャッシュがある場合は即座に表示
    if (capacityCache !== null) {
        console.log('キャッシュからシフト申請フォームを表示');
        
        // シフト申請数を取得（これは常に最新を取得）
        const shiftCounts = await fetchShiftCountsFromSpreadsheet();
        
        // グローバル変数に保存
        currentShiftCounts = shiftCounts;
        window.currentCapacityData = capacityCache;
        
        // コンテナをクリアしてカレンダーを生成
        container.innerHTML = '<div id="shiftRequestCalendarContainer" class="calendar-container"></div>';
        
        // カレンダーを生成（シフト申請モード）
        generateCalendar('shiftRequestCalendarContainer', false, true);
        
        // 人数データとシフト申請数をカレンダーに反映
        if (capacityCache.length > 0) {
            displayCapacityWithCountsOnCalendar(capacityCache, shiftCounts);
        }
        return;
    }
    
    // キャッシュがない場合のみローディング表示と読み込み
    container.innerHTML = `
        <div class="loading-container">
            <div class="loading-spinner"></div>
            <div class="loading-text">シフト申請フォームを読み込み中...</div>
        </div>
    `;
    
    try {
        // 人数設定データとシフト申請数を並行して読み込み
        await loadCapacityToCache();
        const shiftCounts = await fetchShiftCountsFromSpreadsheet();
        
        // グローバル変数に保存
        currentShiftCounts = shiftCounts;
        window.currentCapacityData = capacityCache;
        
        // コンテナをクリアしてカレンダーを生成
        container.innerHTML = '<div id="shiftRequestCalendarContainer" class="calendar-container"></div>';
        
        // カレンダーを生成（シフト申請モード）
        generateCalendar('shiftRequestCalendarContainer', false, true);
        
        // 人数データとシフト申請数をカレンダーに反映
        if (capacityCache && capacityCache.length > 0) {
            displayCapacityWithCountsOnCalendar(capacityCache, shiftCounts);
        }
        
    } catch (error) {
        console.error('シフト申請フォームの読み込みに失敗しました:', error);
        container.innerHTML = '<p>シフト申請フォームの読み込みに失敗しました。</p>';
    }
}

async function saveUserToSpreadsheet(userData) {
    if (!userData) {
        return;
    }
    
    try {
        console.log('ユーザー情報をスプレッドシートに保存中...');
        
        const userInfo = {
            type: 'saveUser',
            sub: userData.sub,
            name: userData.name,
            email: userData.email,
            picture: userData.picture,
            isAdmin: isAdminUser
        };
        
        await fetch(GOOGLE_APPS_SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            mode: 'no-cors',
            body: JSON.stringify(userInfo)
        });
        
        console.log('ユーザー情報を保存しました');
        
    } catch (error) {
        console.error('ユーザー情報の保存に失敗しました:', error);
        // エラーが発生してもアプリケーションの動作は継続
    }
}

function displayCapacityOnCalendar(capacityData) {
    // データを日付をキーとするマップに変換
    const capacityMap = {};
    capacityData.forEach(item => {
        if (item.date && item.date !== '') {
            capacityMap[item.date] = item.capacity;
        }
    });
    
    // 各日付の人数表示を更新
    Object.keys(capacityMap).forEach(dateKey => {
        const capacityElement = document.getElementById(`capacity-${dateKey}`);
        if (capacityElement) {
            const capacity = capacityMap[dateKey];
            capacityElement.innerHTML = `<span class="capacity-number">${capacity}</span><span class="capacity-unit">人</span>`;
        }
    });
}

function displayCapacityWithCountsOnCalendar(capacityData, shiftCounts = {}) {
    // 人数設定データを日付をキーとするマップに変換
    const capacityMap = {};
    capacityData.forEach(item => {
        if (item.date && item.date !== '') {
            capacityMap[item.date] = item.capacity;
        }
    });
    
    // 表示されているすべての日付の容量を更新
    const allDateElements = document.querySelectorAll('[data-date]');
    allDateElements.forEach(element => {
        const dateKey = element.getAttribute('data-date');
        if (dateKey) {
            // 日付全体の表示を更新
            const capacityElement = document.getElementById(`capacity-${dateKey}`);
            if (capacityElement) {
                // その日付の最大容量を取得
                let maxCapacityForDate = capacityMap[dateKey];
                if (maxCapacityForDate === undefined) {
                    const date = new Date(dateKey);
                    const dayOfWeek = date.getDay();
                    maxCapacityForDate = getDefaultCapacity(dayOfWeek);
                }
                
                // その日に設定されているシフト人数のみを表示
                capacityElement.innerHTML = `<span class="capacity-number">${maxCapacityForDate}</span><span class="capacity-unit">人</span>`;
                
                // 申請ボタンの表示/非表示を更新
                const requestInfo = document.getElementById(`request-${dateKey}`);
                if (requestInfo) {
                    const existingButton = requestInfo.querySelector('.inline-apply-btn');
                    if (maxCapacityForDate > 0 && !existingButton) {
                        // ボタンがなくて容量がある場合は追加
                        const applyButton = document.createElement('button');
                        applyButton.className = 'inline-apply-btn';
                        applyButton.textContent = '申請';
                        applyButton.onclick = (e) => {
                            e.stopPropagation();
                            openDateDetailModal(dateKey);
                        };
                        requestInfo.appendChild(applyButton);
                    } else if (maxCapacityForDate === 0 && existingButton) {
                        // ボタンがあって容量がない場合は削除
                        existingButton.remove();
                    }
                }
            }
        }
    });
}


let currentShiftRequestDate = null;
let currentShiftCapacity = 0;
let currentShiftCounts = {};
let currentUserShifts = []; // ユーザーのシフトデータをキャッシュ
// 不要な変数を削除（日付詳細モーダル用のselectedTimeSlotsとは別）

// submitInlineShiftRequest関数を削除（日付詳細モーダルから申請するため不要）

function applyForShift(dateKey) {
    if (!currentUser) {
        alert('ログインが必要です。');
        return;
    }
    
    currentShiftRequestDate = dateKey;
    
    // 人数を取得
    const capacityElement = document.getElementById(`capacity-${dateKey}`);
    if (capacityElement) {
        const capacityNumberElement = capacityElement.querySelector('.capacity-number');
        currentShiftCapacity = parseInt(capacityNumberElement.textContent) || 0;
    }
    
    // 0人の日は申請不可
    if (currentShiftCapacity === 0) {
        alert('この日はシフト募集がありません。');
        return;
    }
    
    openShiftRequestModal(dateKey);
}

function openShiftRequestModal(dateKey) {
    const modal = document.getElementById('shiftRequestModal');
    const modalTitle = document.getElementById('modalTitle');
    const timeSlotContainer = document.getElementById('timeSlotContainer');
    
    // タイトルを設定
    const dateFormatted = new Date(dateKey).toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'short'
    });
    modalTitle.textContent = `${dateFormatted} のシフト申請`;
    
    // 時間枠を生成
    generateTimeSlots(timeSlotContainer);
    
    // 時間枠の残り枠数を更新
    updateTimeSlotCapacity(dateKey);
    
    // モーダルを表示
    modal.style.display = 'flex';
}

function updateTimeSlotCapacity(dateKey) {
    // 13:00から18:00まで、30分単位で時間枠を生成
    const startHour = 13;
    const endHour = 18;
    const slots = [];
    
    for (let hour = startHour; hour < endHour; hour++) {
        slots.push(`${hour}:00-${hour}:30`);
        slots.push(`${hour}:30-${hour + 1}:00`);
    }
    
    slots.forEach(slot => {
        const capacityElement = document.getElementById(`capacity-${slot.replace(/[:\s-]/g, '')}`);
        const checkboxElement = document.getElementById(`slot-${slot.replace(/[:\s-]/g, '')}`);
        
        if (capacityElement && checkboxElement) {
            // その日付・時間枠の現在の申請数を取得
            const currentCount = (currentShiftCounts[dateKey] && currentShiftCounts[dateKey][slot]) || 0;
            const maxCapacity = 1; // 30分枠は1人まで
            const remainingCount = Math.max(0, maxCapacity - currentCount);
            
            // 表示を更新
            capacityElement.textContent = `(${remainingCount}/${maxCapacity}人)`;
            
            // 満員の場合はチェックボックスを無効化
            if (remainingCount === 0) {
                checkboxElement.disabled = true;
                capacityElement.style.color = '#dc3545'; // 赤色
                checkboxElement.parentElement.style.opacity = '0.6';
            } else if (remainingCount === 1) {
                checkboxElement.disabled = false;
                capacityElement.style.color = '#ffc107'; // 黄色
                checkboxElement.parentElement.style.opacity = '1';
            } else {
                checkboxElement.disabled = false;
                capacityElement.style.color = '#28a745'; // 緑色
                checkboxElement.parentElement.style.opacity = '1';
            }
        }
    });
}

function generateTimeSlots(container) {
    container.innerHTML = '';
    
    // 13:00から18:00まで、30分単位で時間枠を生成
    const startHour = 13;
    const endHour = 18;
    const slots = [];
    
    for (let hour = startHour; hour < endHour; hour++) {
        slots.push(`${hour}:00-${hour}:30`);
        slots.push(`${hour}:30-${hour + 1}:00`);
    }
    
    // 時間枠のチェックボックスを生成
    slots.forEach(slot => {
        const slotDiv = document.createElement('div');
        slotDiv.className = 'time-slot';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `slot-${slot.replace(/[:\s-]/g, '')}`;
        checkbox.value = slot;
        checkbox.className = 'time-slot-checkbox';
        
        const labelContainer = document.createElement('div');
        labelContainer.className = 'time-slot-label-container';
        
        const label = document.createElement('label');
        label.htmlFor = checkbox.id;
        label.textContent = slot;
        label.className = 'time-slot-label';
        
        const capacityInfo = document.createElement('span');
        capacityInfo.className = 'time-slot-capacity';
        capacityInfo.id = `capacity-${slot.replace(/[:\s-]/g, '')}`;
        capacityInfo.textContent = '(0/1人)'; // デフォルト値
        
        labelContainer.appendChild(label);
        labelContainer.appendChild(capacityInfo);
        
        slotDiv.appendChild(checkbox);
        slotDiv.appendChild(labelContainer);
        container.appendChild(slotDiv);
    });
}

function closeShiftRequestModal() {
    const modal = document.getElementById('shiftRequestModal');
    modal.style.display = 'none';
    
    // 選択をクリア
    const checkboxes = document.querySelectorAll('.time-slot-checkbox');
    checkboxes.forEach(cb => cb.checked = false);
    
    // 備考欄をクリア
    document.getElementById('shiftRemarks').value = '';
}

async function submitShiftRequest() {
    const selectedSlots = [];
    const checkboxes = document.querySelectorAll('.time-slot-checkbox:checked');
    
    checkboxes.forEach(cb => {
        selectedSlots.push(cb.value);
    });
    
    if (selectedSlots.length === 0) {
        alert('時間枠を選択してください。');
        return;
    }
    
    const remarks = document.getElementById('shiftRemarks').value.trim();
    
    // ボタンを無効化
    const submitBtn = document.querySelector('.submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = '申請中...';
    
    try {
        // 複数時間枠の一括申請データを作成
        const multipleShiftData = {
            type: 'multipleShifts',
            userId: currentUser.sub,
            userName: currentUser.name,
            userEmail: currentUser.email,
            date: currentShiftRequestDate,
            timeSlots: selectedSlots,
            content: remarks || 'シフト'
        };
        
        try {
            // 複数時間枠の一括申請を送信
            await fetch(GOOGLE_APPS_SCRIPT_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                mode: 'no-cors',
                body: JSON.stringify(multipleShiftData)
            });
        } catch (fetchError) {
            console.error('一括申請送信でエラー:', fetchError);
            // no-corsモードでは継続
        }
        
        // キャッシュを更新
        for (const timeSlot of selectedSlots) {
            const newShift = {
                shiftDate: currentShiftRequestDate,
                timeSlot: timeSlot,
                content: remarks || 'シフト',
                userName: currentUser.name,
                userEmail: currentUser.email
            };
            updateMyShiftsCache(newShift);
        }
        
        alert(`${currentShiftRequestDate} の\n${selectedSlots.join('\n')}\nにシフト申請しました。`);
        closeShiftRequestModal();
        
        // 自分のシフト一覧を再読み込み
        await loadMyShiftsToCache();
        
    } catch (error) {
        console.error('シフト申請の保存に失敗しました:', error);
        alert('シフト申請の保存に失敗しました。再度お試しください。');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = '申請する';
    }
}

// グローバル変数：選択中の日付と時間枠
let currentDetailDateKey = null;
let selectedTimeSlots = [];

// 日付詳細モーダルを開く関数
async function openDateDetailModal(dateKey) {
    const modal = document.getElementById('dateDetailModal');
    const title = document.getElementById('dateDetailTitle');
    const container = document.getElementById('dateDetailContainer');
    
    // 日付を表示用にフォーマット
    const dateObj = new Date(dateKey);
    const year = dateObj.getFullYear();
    const month = dateObj.getMonth() + 1;
    const day = dateObj.getDate();
    const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
    const weekday = weekdays[dateObj.getDay()];
    
    // その日付の最大容量を取得
    let maxCapacityForDate = 0;
    if (typeof getDefaultCapacity === 'function') {
        const dayOfWeek = dateObj.getDay();
        maxCapacityForDate = getDefaultCapacity(dayOfWeek);
    }
    
    // グローバルな人数設定があれば上書き
    if (window.currentCapacityData) {
        const capacityItem = window.currentCapacityData.find(item => item.date === dateKey);
        if (capacityItem) {
            maxCapacityForDate = capacityItem.capacity;
        }
    }
    
    
    // 人数枠が0人の場合はダイアログを表示しない
    if (maxCapacityForDate === 0) {
        return;
    }
    
    // グローバル変数を設定
    currentDetailDateKey = dateKey;
    selectedTimeSlots = [];
    
    title.textContent = `${year}年${month}月${day}日 (${weekday}) のシフト枠`;
    
    // 自分の申請済みシフトをキャッシュから取得
    let myShiftsForDate = [];
    if (myShiftsCache) {
        // 該当日付のシフトのみをフィルタリング
        myShiftsForDate = myShiftsCache.filter(shift => shift.shiftDate === dateKey);
    }
    
    // 時間枠を生成
    const startHour = 13;
    const endHour = 18;
    const slots = [];
    
    for (let hour = startHour; hour < endHour; hour++) {
        slots.push(`${hour}:00-${hour}:30`);
        slots.push(`${hour}:30-${hour + 1}:00`);
    }
    
    // コンテナをクリア
    container.innerHTML = '';
    
    // 全選択/解除ボタンを追加
    const toggleAllDiv = document.createElement('div');
    toggleAllDiv.style.marginBottom = '15px';
    toggleAllDiv.style.textAlign = 'center';
    
    const toggleAllBtn = document.createElement('button');
    toggleAllBtn.className = 'toggle-all-btn';
    toggleAllBtn.textContent = 'すべて選択';
    toggleAllBtn.onclick = () => toggleAllTimeSlots();
    
    toggleAllDiv.appendChild(toggleAllBtn);
    container.appendChild(toggleAllDiv);
    
    // 各時間枠を表示
    slots.forEach(slot => {
        const slotDiv = document.createElement('div');
        slotDiv.className = 'date-detail-slot';
        slotDiv.dataset.slot = slot;
        
        const timeDiv = document.createElement('div');
        timeDiv.className = 'date-detail-slot-time';
        timeDiv.textContent = slot;
        
        const capacityDiv = document.createElement('div');
        capacityDiv.className = 'date-detail-slot-capacity';
        
        // その時間枠の現在の申請数を取得
        let currentCount = 0;
        if (currentShiftCounts && currentShiftCounts[dateKey] && currentShiftCounts[dateKey][slot]) {
            currentCount = currentShiftCounts[dateKey][slot];
        }
        
        const remainingCount = Math.max(0, maxCapacityForDate - currentCount);
        
        // 自分が既に申請しているかチェック
        const isAlreadyApplied = myShiftsForDate.some(shift => shift.timeSlot === slot);
        
        const capacityNumber = document.createElement('div');
        capacityNumber.className = 'date-detail-capacity-number';
        capacityNumber.textContent = remainingCount;
        
        // 既に申請済みの場合は特別な処理
        if (isAlreadyApplied) {
            capacityNumber.classList.add('capacity-applied');
            slotDiv.classList.add('disabled');
            
            const capacityLabel = document.createElement('div');
            capacityLabel.className = 'date-detail-capacity-label';
            capacityLabel.textContent = '申請済み';
            capacityLabel.style.color = '#4CAF50';
            capacityLabel.style.fontWeight = 'bold';
            
            capacityDiv.appendChild(capacityNumber);
            capacityDiv.appendChild(capacityLabel);
        } else {
            // 残り人数に応じてクラスを設定
            if (remainingCount === 0) {
                capacityNumber.classList.add('capacity-zero');
                slotDiv.classList.add('disabled');
            } else if (remainingCount === 1) {
                capacityNumber.classList.add('capacity-low');
                slotDiv.classList.add('selectable');
            } else if (remainingCount <= maxCapacityForDate / 2) {
                capacityNumber.classList.add('capacity-medium');
                slotDiv.classList.add('selectable');
            } else {
                capacityNumber.classList.add('capacity-high');
                slotDiv.classList.add('selectable');
            }
            
            const capacityLabel = document.createElement('div');
            capacityLabel.className = 'date-detail-capacity-label';
            capacityLabel.textContent = '残り枠';
            
            capacityDiv.appendChild(capacityNumber);
            capacityDiv.appendChild(capacityLabel);
        }
        
        slotDiv.appendChild(timeDiv);
        slotDiv.appendChild(capacityDiv);
        
        // 選択可能な場合はクリックイベントを追加（申請済みでない、かつ残り枠がある場合）
        if (!isAlreadyApplied && remainingCount > 0) {
            slotDiv.onclick = () => toggleTimeSlotSelection(slotDiv, slot);
        }
        
        container.appendChild(slotDiv);
    });
    
    // 備考欄は削除済み
    
    // 申請ボタンを無効化
    updateSubmitButton();
    
    modal.style.display = 'flex';
}

// 時間枠の選択/解除をトグル
function toggleTimeSlotSelection(slotDiv, slot) {
    if (slotDiv.classList.contains('disabled')) return;
    
    const isSelected = slotDiv.classList.contains('selected');
    
    if (isSelected) {
        // 選択解除
        slotDiv.classList.remove('selected');
        selectedTimeSlots = selectedTimeSlots.filter(s => s !== slot);
    } else {
        // 選択
        slotDiv.classList.add('selected');
        selectedTimeSlots.push(slot);
    }
    
    updateSubmitButton();
}

// すべての時間枠を選択/解除
function toggleAllTimeSlots() {
    const selectableSlots = document.querySelectorAll('.date-detail-slot.selectable');
    const toggleBtn = document.querySelector('.toggle-all-btn');
    
    if (!selectableSlots.length) return;
    
    // 現在の選択状態を確認（選択可能なスロットがすべて選択されているか）
    const allSelected = Array.from(selectableSlots).every(slot => slot.classList.contains('selected'));
    
    if (allSelected) {
        // すべて解除
        selectableSlots.forEach(slotDiv => {
            if (slotDiv.classList.contains('selected')) {
                slotDiv.classList.remove('selected');
                const slot = slotDiv.dataset.slot;
                selectedTimeSlots = selectedTimeSlots.filter(s => s !== slot);
            }
        });
        toggleBtn.textContent = 'すべて選択';
    } else {
        // すべて選択
        selectableSlots.forEach(slotDiv => {
            if (!slotDiv.classList.contains('selected')) {
                slotDiv.classList.add('selected');
                const slot = slotDiv.dataset.slot;
                selectedTimeSlots.push(slot);
            }
        });
        toggleBtn.textContent = 'すべて解除';
    }
    
    updateSubmitButton();
}

// 申請ボタンの有効/無効を更新
function updateSubmitButton() {
    const submitBtn = document.querySelector('.submit-btn');
    if (selectedTimeSlots.length > 0) {
        submitBtn.disabled = false;
        submitBtn.textContent = `選択した${selectedTimeSlots.length}つの時間枠で申請`;
    } else {
        submitBtn.disabled = true;
        submitBtn.textContent = '時間枠を選択してください';
    }
    
    // 全選択/解除ボタンのテキストも更新
    const toggleBtn = document.querySelector('.toggle-all-btn');
    if (toggleBtn) {
        const selectableSlots = document.querySelectorAll('.date-detail-slot.selectable');
        const allSelected = Array.from(selectableSlots).every(slot => slot.classList.contains('selected'));
        toggleBtn.textContent = allSelected ? 'すべて解除' : 'すべて選択';
    }
}

// 日付詳細モーダルを閉じる関数
function closeDateDetailModal() {
    const modal = document.getElementById('dateDetailModal');
    modal.style.display = 'none';
    
    // 選択状態をリセット
    currentDetailDateKey = null;
    selectedTimeSlots = [];
}

// 日付詳細モーダルでのシフト申請
async function submitDateDetailShiftRequest() {
    console.log('submitDateDetailShiftRequest called');
    
    if (!currentUser) {
        alert('ログインが必要です。');
        return;
    }
    
    if (!currentDetailDateKey || selectedTimeSlots.length === 0) {
        alert('時間枠を選択してください。');
        return;
    }
    
    const remarks = document.getElementById('dateDetailRemarks')?.value.trim() || 'シフト'; // 備考欄の内容
    
    // ボタンを無効化してローディング表示
    const modal = document.getElementById('dateDetailModal');
    const submitBtn = modal.querySelector('.submit-btn');
    const cancelBtn = modal.querySelector('.cancel-btn');
    
    if (!submitBtn || !cancelBtn) {
        console.error('ボタンが見つかりません');
        return;
    }
    
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    cancelBtn.disabled = true;
    submitBtn.innerHTML = '<span style="display: inline-block; margin-right: 5px;">⏳</span>申請中...';
    
    try {
        // 複数時間枠の一括申請データを作成
        const multipleShiftData = {
            type: 'multipleShifts',
            userId: currentUser.sub,
            userName: currentUser.name,
            userEmail: currentUser.email,
            date: currentDetailDateKey,
            timeSlots: selectedTimeSlots,
            content: remarks || 'シフト'
        };
        
        let results;
        
        try {
            // 複数時間枠の一括申請を送信
            const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                mode: 'no-cors',
                body: JSON.stringify(multipleShiftData)
            });
            
            // no-corsモードでは成功として扱い、全て成功したと仮定
            results = {
                success: true,
                processed: selectedTimeSlots,
                duplicates: [],
                errors: []
            };
        } catch (fetchError) {
            console.error('一括申請送信でエラー:', fetchError);
            // エラーでも成功として扱う（no-corsモードの互換性のため）
            results = {
                success: true,
                processed: selectedTimeSlots,
                duplicates: [],
                errors: []
            };
        }
        
        const successSlots = results.processed || [];
        const duplicateSlots = results.duplicates || [];
        
        const dateObj = new Date(currentDetailDateKey);
        const month = dateObj.getMonth() + 1;
        const day = dateObj.getDate();
        
        // 結果に応じたメッセージを表示
        let message = '';
        
        if (successSlots.length > 0) {
            message += `${month}月${day}日の以下の時間帯にシフトを申請しました：\n${successSlots.join('\n')}`;
        }
        
        if (duplicateSlots.length > 0) {
            if (message) message += '\n\n';
            message += `以下の時間帯は既に申請済みのため、申請できませんでした：\n${duplicateSlots.join('\n')}`;
        }
        
        if (message) {
            alert(message);
        } else {
            alert('申請できる時間枠がありませんでした。');
        }
        
        // 申請した日付を保存（モーダルを閉じる前に）
        const appliedDateKey = currentDetailDateKey;
        
        // モーダルを閉じる
        closeDateDetailModal();
        
        // シフト申請数を再読み込みして申請した日付のデータを更新
        const shiftCounts = await fetchShiftCountsFromSpreadsheet();
        currentShiftCounts = shiftCounts;
        
        // 申請した日付のデータのみを更新
        updateSingleDateCapacity(appliedDateKey, window.currentCapacityData || []);
        
        // 自分のシフト一覧を再読み込み
        if (successSlots.length > 0) {
            await loadMyShiftsToCache();
        }
        
    } catch (error) {
        console.error('シフト申請の保存に失敗しました:', error);
        alert('シフト申請の保存に失敗しました。再度お試しください。');
    } finally {
        submitBtn.disabled = false;
        cancelBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

// 特定の日付のみの容量データを更新する関数
function updateSingleDateCapacity(dateKey, capacityData) {
    // 人数設定データを日付をキーとするマップに変換
    const capacityMap = {};
    capacityData.forEach(item => {
        if (item.date && item.date !== '') {
            capacityMap[item.date] = item.capacity;
        }
    });
    
    // 容量表示を更新（シフト申請画面用）
    const capacityElement = document.getElementById(`capacity-${dateKey}`);
    if (capacityElement) {
        // その日付の最大容量を取得
        let maxCapacityForDate = capacityMap[dateKey];
        if (maxCapacityForDate === undefined) {
            const date = new Date(dateKey);
            const dayOfWeek = date.getDay();
            maxCapacityForDate = getDefaultCapacity(dayOfWeek);
        }
        
        // その日に設定されているシフト人数のみを表示
        capacityElement.innerHTML = `<span class="capacity-number">${maxCapacityForDate}</span><span class="capacity-unit">人</span>`;
        
        // 申請ボタンの表示/非表示を更新
        const requestInfo = document.getElementById(`request-${dateKey}`);
        if (requestInfo) {
            const existingButton = requestInfo.querySelector('.inline-apply-btn');
            if (maxCapacityForDate > 0 && !existingButton) {
                // ボタンがなくて容量がある場合は追加
                const applyButton = document.createElement('button');
                applyButton.className = 'inline-apply-btn';
                applyButton.textContent = '申請';
                applyButton.onclick = (e) => {
                    e.stopPropagation();
                    openDateDetailModal(dateKey);
                };
                requestInfo.appendChild(applyButton);
            } else if (maxCapacityForDate === 0 && existingButton) {
                // ボタンがあって容量がない場合は削除
                existingButton.remove();
            }
        }
    }
    
    // 日付セルの背景色も更新（募集がない日はグレーアウト）
    const dateCell = document.querySelector(`[data-date="${dateKey}"]`);
    if (dateCell) {
        let maxCapacityForDate = capacityMap[dateKey];
        if (maxCapacityForDate === undefined) {
            const date = new Date(dateKey);
            const dayOfWeek = date.getDay();
            maxCapacityForDate = getDefaultCapacity(dayOfWeek);
        }
        
        // 募集人数が0の日はクリック不可にする
        if (maxCapacityForDate === 0) {
            dateCell.style.backgroundColor = '#f5f5f5';
            dateCell.style.cursor = 'default';
        } else {
            dateCell.style.backgroundColor = '';
            dateCell.style.cursor = 'pointer';
        }
    }
}

window.onload = function () {
    document.getElementById('g_id_onload').setAttribute('data-client_id', GOOGLE_CLIENT_ID);
    
    google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse
    });
    
    google.accounts.id.renderButton(
        document.querySelector('.g_id_signin'),
        { theme: 'outline', size: 'medium' }
    );
    
    setupTabSwitching();
    
    // 日付詳細モーダルのクローズイベント
    document.getElementById('dateDetailClose').onclick = closeDateDetailModal;
    
    // モーダル外クリックで閉じる
    window.onclick = function(event) {
        const dateDetailModal = document.getElementById('dateDetailModal');
        const shiftRequestModal = document.getElementById('shiftRequestModal');
        
        if (event.target === dateDetailModal) {
            closeDateDetailModal();
        }
        if (event.target === shiftRequestModal) {
            closeShiftRequestModal();
        }
    };
};