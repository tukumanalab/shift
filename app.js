const GOOGLE_APPS_SCRIPT_URL = config.GOOGLE_APPS_SCRIPT_URL;
const GOOGLE_CLIENT_ID = config.GOOGLE_CLIENT_ID;
const AUTHORIZED_EMAILS = config.AUTHORIZED_EMAILS.split(',').map(email => email.trim());

let currentUser = null;
let isAdminUser = false;

function handleCredentialResponse(response) {
    const responsePayload = decodeJwtResponse(response.credential);
    
    console.log("ID: " + responsePayload.sub);
    console.log('Full Name: ' + responsePayload.name);
    console.log('Given Name: ' + responsePayload.given_name);
    console.log('Family Name: ' + responsePayload.family_name);
    console.log("Image URL: " + responsePayload.picture);
    console.log("Email: " + responsePayload.email);

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
    
    // 初期ロード
    if (isAdminUser) {
        loadShiftList();
    } else {
        loadMyShifts();
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
        syncBtn.textContent = 'すべてのシフトをカレンダーに同期';
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
                loadMyShifts();
            } else if (targetTab === 'shift-request') {
                loadShiftRequestForm();
            }
        });
    });
}

function loadShiftList() {
    // TODO: Implement shift list loading from Google Sheets
    console.log('Loading shift list...');
    generateCalendar('shiftCalendarContainer');
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
                    // シフト申請モードの場合は時間枠を直接表示
                    const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
                    
                    const requestInfo = document.createElement('div');
                    requestInfo.className = 'shift-request-info';
                    requestInfo.id = `request-${dateKey}`;
                    
                    // 必要人数表示
                    const capacityInfo = document.createElement('div');
                    capacityInfo.className = 'shift-capacity-info';
                    capacityInfo.id = `capacity-${dateKey}`;
                    capacityInfo.innerHTML = `<span class="capacity-number">${getDefaultCapacity(dayOfWeek)}</span><span class="capacity-unit">人</span>`;
                    requestInfo.appendChild(capacityInfo);
                    
                    const timeSlotsContainer = document.createElement('div');
                    timeSlotsContainer.className = 'inline-time-slots';
                    timeSlotsContainer.id = `timeslots-${dateKey}`;
                    
                    // 時間枠を生成（13:00-18:00、30分単位）
                    const startHour = 13;
                    const endHour = 18;
                    const slots = [];
                    
                    for (let hour = startHour; hour < endHour; hour++) {
                        slots.push(`${hour}:00-${hour}:30`);
                        slots.push(`${hour}:30-${hour + 1}:00`);
                    }
                    
                    slots.forEach(slot => {
                        const slotDiv = document.createElement('div');
                        slotDiv.className = 'inline-time-slot';
                        slotDiv.id = `slot-${dateKey}-${slot.replace(/[:-]/g, '')}`;
                        slotDiv.dataset.slot = slot;
                        slotDiv.dataset.selected = 'false';
                        
                        // トグル式ラベル（クリック可能）
                        const timeLabel = document.createElement('span');
                        timeLabel.className = 'inline-time-label';
                        // 時間表示を短縮（例: "13:00-13:30" → "13:00-30"）
                        const shortTime = slot.replace(/(\d+):(\d+)-(\d+):(\d+)/, '$1:$2-$4');
                        timeLabel.textContent = shortTime;
                        
                        const capacityInfo = document.createElement('span');
                        capacityInfo.className = 'inline-time-slot-capacity';
                        capacityInfo.id = `capacity-${dateKey}-${slot.replace(/[:-]/g, '')}`;
                        // デフォルト容量を使用（後でupdateInlineTimeSlotCapacityで正しい値に更新される）
                        const defaultCapacity = getDefaultCapacity(dayOfWeek);
                        capacityInfo.textContent = `${defaultCapacity}`;
                        
                        // クリックイベントでトグル
                        slotDiv.onclick = () => handleTimeSlotToggle(dateKey, slot, slotDiv);
                        
                        slotDiv.appendChild(timeLabel);
                        slotDiv.appendChild(capacityInfo);
                        timeSlotsContainer.appendChild(slotDiv);
                    });
                    
                    requestInfo.appendChild(timeSlotsContainer);
                    
                    // 申請ボタン
                    const applyBtn = document.createElement('button');
                    applyBtn.className = 'inline-apply-btn';
                    applyBtn.textContent = '申請';
                    applyBtn.id = `apply-${dateKey}`;
                    applyBtn.onclick = () => submitInlineShiftRequest(dateKey, currentDate);
                    applyBtn.disabled = true; // 最初は無効化
                    
                    requestInfo.appendChild(applyBtn);
                    
                    cell.appendChild(requestInfo);
                    cell.setAttribute('data-date', dateKey);
                } else {
                    // シフト一覧モードの場合はシフト情報表示用のエリア
                    const shiftInfo = document.createElement('div');
                    shiftInfo.className = 'calendar-shift-info';
                    shiftInfo.id = `shift-${year}-${month + 1}-${date}`;
                    cell.appendChild(shiftInfo);
                    
                    // クリックイベント
                    cell.setAttribute('data-date', `${year}-${String(month + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`);
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

function handleCalendarCellClick(event) {
    const cell = event.currentTarget;
    const date = cell.getAttribute('data-date');
    if (!date) return;
    
    console.log('Clicked date:', date);
    // TODO: 日付に応じた処理を実装
}

async function loadCapacitySettings() {
    console.log('Loading capacity settings...');
    
    // ローディングアイコンを表示
    const loadingContainer = document.getElementById('capacityLoadingContainer');
    const calendarContainer = document.getElementById('capacityCalendarContainer');
    
    loadingContainer.style.display = 'flex';
    calendarContainer.style.display = 'none';
    
    try {
        // スプレッドシートから人数設定を読み込み
        const capacityData = await fetchCapacityFromSpreadsheet();
        
        // カレンダーを生成
        generateCalendar('capacityCalendarContainer', true);
        
        // 読み込んだデータを入力フィールドに反映
        if (capacityData && capacityData.length > 0) {
            applyCapacityData(capacityData);
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
        
        const response = await fetch(`${GOOGLE_APPS_SCRIPT_URL}?type=loadCapacity`, {
            method: 'GET'
        });
        
        if (response.ok) {
            const result = await response.json();
            if (result.success) {
                console.log('人数設定をスプレッドシートから読み込みました:', result.data);
                return result.data || [];
            } else {
                console.error('人数設定の読み込みに失敗:', result.error);
                return [];
            }
        } else {
            console.error('HTTPエラー:', response.status);
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
        console.log('シフト申請数を読み込み中...');
        
        const response = await fetch(`${GOOGLE_APPS_SCRIPT_URL}?type=loadShiftCounts`, {
            method: 'GET'
        });
        
        if (response.ok) {
            const result = await response.json();
            if (result.success) {
                console.log('シフト申請数をスプレッドシートから読み込みました:', result.data);
                return result.data || {};
            } else {
                console.error('シフト申請数の読み込みに失敗:', result.error);
                return {};
            }
        } else {
            console.error('HTTPエラー:', response.status);
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

async function loadMyShifts() {
    console.log('自分のシフト一覧を読み込み中...');
    const container = document.getElementById('myShiftsContent');
    if (!container) return;
    
    if (!currentUser) {
        container.innerHTML = '<p>ログインが必要です。</p>';
        return;
    }
    
    // ローディング表示
    container.innerHTML = `
        <div class="loading-container">
            <div class="loading-spinner"></div>
            <div class="loading-text">自分のシフト一覧を読み込み中...</div>
        </div>
    `;
    
    try {
        // ユーザーのシフトデータを取得
        const response = await fetch(`${GOOGLE_APPS_SCRIPT_URL}?type=loadMyShifts&userId=${currentUser.sub}`, {
            method: 'GET'
        });
        
        if (response.ok) {
            const result = await response.json();
            if (result.success && result.data) {
                displayMyShifts(container, result.data);
            } else {
                container.innerHTML = '<p>シフトデータの読み込みに失敗しました。</p>';
            }
        } else {
            container.innerHTML = '<p>シフトデータの読み込みに失敗しました。</p>';
        }
        
    } catch (error) {
        console.error('シフトデータの読み込みに失敗しました:', error);
        container.innerHTML = '<p>シフトデータの読み込みに失敗しました。</p>';
    }
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
    
    // シフトテーブルを作成
    let tableHTML = `
        <div class="my-shifts-summary">
            <h4>登録済みシフト: ${shiftsData.length}件</h4>
        </div>
        <div class="my-shifts-table-container">
            <table class="my-shifts-table">
                <thead>
                    <tr>
                        <th>シフト日</th>
                        <th>時間帯</th>
                        <th>備考</th>
                        <th>申請日</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    shiftsData.forEach(shift => {
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
        
        // 過去のシフトかどうか判定
        const isPastShift = shiftDate < new Date();
        const rowClass = isPastShift ? 'past-shift' : 'future-shift';
        
        tableHTML += `
            <tr class="${rowClass}">
                <td class="shift-date">${formattedDate}</td>
                <td class="shift-time">${shift.timeSlot}</td>
                <td class="shift-content">${shift.content || '-'}</td>
                <td class="shift-reg-date">${formattedRegDate}</td>
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

async function loadShiftRequestForm() {
    console.log('シフト申請フォームを読み込み中...');
    const container = document.getElementById('shiftRequestContent');
    if (!container) return;
    
    // ローディング表示
    container.innerHTML = `
        <div class="loading-container">
            <div class="loading-spinner"></div>
            <div class="loading-text">シフト申請フォームを読み込み中...</div>
        </div>
    `;
    
    try {
        // 人数設定データとシフト申請数を並行して読み込み
        const [capacityData, shiftCounts] = await Promise.all([
            fetchCapacityFromSpreadsheet(),
            fetchShiftCountsFromSpreadsheet()
        ]);
        
        // グローバル変数に保存
        currentShiftCounts = shiftCounts;
        
        // コンテナをクリアしてカレンダーを生成
        container.innerHTML = '<div id="shiftRequestCalendarContainer" class="calendar-container"></div>';
        
        // カレンダーを生成（シフト申請モード）
        generateCalendar('shiftRequestCalendarContainer', false, true);
        
        // 人数データとシフト申請数をカレンダーに反映
        if (capacityData && capacityData.length > 0) {
            displayCapacityWithCountsOnCalendar(capacityData, shiftCounts);
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
    
    // 表示されているすべての日付の時間枠を更新
    const allDateElements = document.querySelectorAll('[data-date]');
    allDateElements.forEach(element => {
        const dateKey = element.getAttribute('data-date');
        if (dateKey) {
            // 時間枠ごとの容量を更新
            updateInlineTimeSlotCapacity(dateKey, shiftCounts, capacityMap);
            
            // 日付全体の表示を更新（利用可能な時間枠数で計算）
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
            }
        }
    });
}

function updateInlineTimeSlotCapacity(dateKey, shiftCounts = {}, capacityMap = {}) {
    // 13:00から18:00まで、30分単位で時間枠を生成
    const startHour = 13;
    const endHour = 18;
    const slots = [];
    
    for (let hour = startHour; hour < endHour; hour++) {
        slots.push(`${hour}:00-${hour}:30`);
        slots.push(`${hour}:30-${hour + 1}:00`);
    }
    
    // その日付の最大容量を取得（設定がない場合はデフォルト値を使用）
    let maxCapacityForDate = capacityMap[dateKey];
    if (maxCapacityForDate === undefined) {
        // デフォルト値を計算
        const date = new Date(dateKey);
        const dayOfWeek = date.getDay();
        maxCapacityForDate = getDefaultCapacity(dayOfWeek);
    }
    
    slots.forEach(slot => {
        const capacityElement = document.getElementById(`capacity-${dateKey}-${slot.replace(/[:-]/g, '')}`);
        const slotElement = document.getElementById(`slot-${dateKey}-${slot.replace(/[:-]/g, '')}`);
        
        if (capacityElement && slotElement) {
            // その日付・時間枠の現在の申請数を取得
            const currentCount = (shiftCounts[dateKey] && shiftCounts[dateKey][slot]) || 0;
            
            // デバッグ: 最初の日付の最初のスロットのみログ出力
            if (dateKey === '2025-07-23' && slot === '13:00-13:30') {
                console.log(`デバッグ: ${dateKey} ${slot} - 申請数: ${currentCount}`);
                console.log('shiftCounts全体:', shiftCounts);
                console.log('shiftCounts[dateKey]:', shiftCounts[dateKey]);
                console.log('slot:', slot);
                console.log('shiftCounts[dateKey][slot]:', shiftCounts[dateKey] && shiftCounts[dateKey][slot]);
                console.log('shiftCounts[dateKey]のキー一覧:', shiftCounts[dateKey] ? Object.keys(shiftCounts[dateKey]) : 'なし');
            }
            
            const maxCapacity = maxCapacityForDate; // その日の設定人数が各時間枠の最大人数
            const remainingCount = Math.max(0, maxCapacity - currentCount);
            
            capacityElement.textContent = remainingCount;
            
            // 残り人数に応じてクラスを設定（色分け用）
            capacityElement.className = 'inline-time-slot-capacity';
            if (remainingCount === 0) {
                capacityElement.classList.add('capacity-zero');
                slotElement.classList.add('disabled');
            } else if (remainingCount === 1) {
                capacityElement.classList.add('capacity-low');
                slotElement.classList.remove('disabled');
            } else if (remainingCount <= maxCapacity / 2) {
                capacityElement.classList.add('capacity-medium');
                slotElement.classList.remove('disabled');
            } else {
                capacityElement.classList.add('capacity-high');
                slotElement.classList.remove('disabled');
            }
        }
    });
}

let currentShiftRequestDate = null;
let currentShiftRequestDateObj = null;
let currentShiftCapacity = 0;
let currentShiftCounts = {};
let selectedTimeSlots = {}; // 日付ごとの選択された時間枠を管理

function handleTimeSlotToggle(dateKey, slot, slotElement) {
    console.log('handleTimeSlotToggle called:', dateKey, slot, slotElement);
    
    // 残り容量が0の場合は選択不可
    if (slotElement.classList.contains('disabled')) {
        console.log('スロットが無効化されています');
        return;
    }
    
    if (!selectedTimeSlots[dateKey]) {
        selectedTimeSlots[dateKey] = [];
    }
    
    const isCurrentlySelected = slotElement.dataset.selected === 'true';
    console.log('現在の選択状態:', isCurrentlySelected);
    
    if (isCurrentlySelected) {
        // 選択解除
        console.log('選択解除中...');
        slotElement.dataset.selected = 'false';
        slotElement.classList.remove('selected');
        const index = selectedTimeSlots[dateKey].indexOf(slot);
        if (index > -1) {
            selectedTimeSlots[dateKey].splice(index, 1);
        }
        console.log('選択解除完了、クラス:', slotElement.className);
    } else {
        // 選択
        console.log('選択中...');
        slotElement.dataset.selected = 'true';
        slotElement.classList.add('selected');
        if (!selectedTimeSlots[dateKey].includes(slot)) {
            selectedTimeSlots[dateKey].push(slot);
        }
        console.log('選択完了、クラス:', slotElement.className);
    }
    
    // 申請ボタンの状態を更新
    const applyBtn = document.getElementById(`apply-${dateKey}`);
    if (applyBtn) {
        applyBtn.disabled = !selectedTimeSlots[dateKey] || selectedTimeSlots[dateKey].length === 0;
    }
}

async function submitInlineShiftRequest(dateKey, dateObj) {
    if (!currentUser) {
        alert('ログインが必要です。');
        return;
    }
    
    const selectedSlots = selectedTimeSlots[dateKey] || [];
    if (selectedSlots.length === 0) {
        alert('時間枠を選択してください。');
        return;
    }
    
    // ボタンを無効化
    const submitBtn = document.getElementById(`apply-${dateKey}`);
    submitBtn.disabled = true;
    submitBtn.textContent = '申請中...';
    
    try {
        // 各時間枠について申請を送信
        for (const slot of selectedSlots) {
            const shiftData = {
                type: 'shift',
                userId: currentUser.sub,
                userName: currentUser.name,
                userEmail: currentUser.email,
                date: dateKey,
                time: slot,
                content: '通常業務' // デフォルトの内容
            };
            
            const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                mode: 'no-cors',
                body: JSON.stringify(shiftData)
            });
            
            // no-corsモードでは詳細なレスポンスを取得できないため、
            // 少し待ってから次の申請を送信
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        alert(`${selectedSlots.length}つの時間枠でシフト申請を送信しました。`);
        
        // 選択をクリア
        selectedTimeSlots[dateKey] = [];
        const slots = document.querySelectorAll(`div[id^="slot-${dateKey}-"]`);
        slots.forEach(slot => {
            slot.classList.remove('selected');
            slot.dataset.selected = 'false';
        });
        
        // データを再読み込み
        await loadShiftRequestForm();
        
    } catch (error) {
        console.error('シフト申請の送信に失敗しました:', error);
        alert('シフト申請の送信に失敗しました。もう一度お試しください。');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = '申請';
    }
}

function applyForShift(dateKey, dateObj) {
    if (!currentUser) {
        alert('ログインが必要です。');
        return;
    }
    
    currentShiftRequestDate = dateKey;
    currentShiftRequestDateObj = dateObj;
    
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
    
    openShiftRequestModal(dateKey, dateObj);
}

function openShiftRequestModal(dateKey, dateObj) {
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
        // 各時間枠ごとにシフトデータを作成して送信
        for (const timeSlot of selectedSlots) {
            const shiftData = {
                type: 'shift',
                userId: currentUser.sub,
                userName: currentUser.name,
                userEmail: currentUser.email,
                date: currentShiftRequestDate,
                time: timeSlot,
                content: remarks || 'シフト'
            };
            
            await fetch(GOOGLE_APPS_SCRIPT_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                mode: 'no-cors',
                body: JSON.stringify(shiftData)
            });
        }
        
        alert(`${currentShiftRequestDate} の\n${selectedSlots.join('\n')}\nにシフトを申請しました。`);
        closeShiftRequestModal();
        
    } catch (error) {
        console.error('シフト申請の保存に失敗しました:', error);
        alert('シフト申請の保存に失敗しました。再度お試しください。');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = '申請する';
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
};