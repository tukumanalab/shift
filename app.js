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


function showProfile(profileData) {
    currentUser = profileData;
    
    document.getElementById('loginButton').classList.add('hidden');
    document.getElementById('profileInfo').classList.remove('hidden');
    document.getElementById('loginPrompt').classList.add('hidden');
    document.getElementById('appContent').classList.remove('hidden');
    
    document.getElementById('userImage').src = profileData.picture;
    document.getElementById('userName').textContent = profileData.name;
    document.getElementById('userEmail').textContent = profileData.email;
    
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

function generateCalendar(containerId, isCapacityMode = false) {
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
        const monthDiv = createMonthCalendar(currentDate.getFullYear(), currentDate.getMonth(), isCapacityMode);
        container.appendChild(monthDiv);
        currentDate.setMonth(currentDate.getMonth() + 1);
    }
}

function createMonthCalendar(year, month, isCapacityMode = false) {
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
    const adminTabs = ['shift-list', 'capacity-settings'];
    const userTabs = ['my-shifts', 'shift-request'];
    
    tabButtons.forEach(button => {
        const tabId = button.getAttribute('data-tab');
        
        if (isAdminUser) {
            // 管理者は管理者用タブのみ表示
            if (adminTabs.includes(tabId)) {
                button.style.display = 'inline-block';
            } else {
                button.style.display = 'none';
            }
        } else {
            // 一般ユーザーは一般ユーザー用タブのみ表示
            if (userTabs.includes(tabId)) {
                button.style.display = 'inline-block';
            } else {
                button.style.display = 'none';
            }
        }
    });
    
    // 最初に表示するタブを選択
    const visibleButtons = Array.from(tabButtons).filter(btn => btn.style.display !== 'none');
    if (visibleButtons.length > 0) {
        visibleButtons[0].click();
    }
}

function loadMyShifts() {
    console.log('自分のシフト一覧を読み込み中...');
    const container = document.getElementById('myShiftsContent');
    if (container) {
        container.innerHTML = '<p>自分のシフト一覧を読み込み中...</p>';
        // TODO: 自分のシフト一覧を実装
    }
}

function loadShiftRequestForm() {
    console.log('シフト申請フォームを読み込み中...');
    const container = document.getElementById('shiftRequestContent');
    if (container) {
        container.innerHTML = '<p>シフト申請フォームを読み込み中...</p>';
        // TODO: シフト申請フォームを実装
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