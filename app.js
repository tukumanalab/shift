const GOOGLE_APPS_SCRIPT_URL = config.GOOGLE_APPS_SCRIPT_URL;
const GOOGLE_CLIENT_ID = config.GOOGLE_CLIENT_ID;

let currentUser = null;
let shiftInfo = null;

function handleCredentialResponse(response) {
    const responsePayload = decodeJwtResponse(response.credential);
    
    console.log("ID: " + responsePayload.sub);
    console.log('Full Name: ' + responsePayload.name);
    console.log('Given Name: ' + responsePayload.given_name);
    console.log('Family Name: ' + responsePayload.family_name);
    console.log("Image URL: " + responsePayload.picture);
    console.log("Email: " + responsePayload.email);

    saveLoginToSpreadsheet(responsePayload);
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

async function saveLoginToSpreadsheet(profileData) {
    try {
        await fetch(GOOGLE_APPS_SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            mode: 'no-cors',
            body: JSON.stringify({
                sub: profileData.sub,
                name: profileData.name,
                email: profileData.email,
                picture: profileData.picture
            })
        });
        
        console.log('ログイン情報をスプレッドシートに保存しました');
    } catch (error) {
        console.error('スプレッドシートへの保存に失敗しました:', error);
    }
}

function showProfile(profileData) {
    currentUser = profileData;
    
    document.getElementById('loginSection').classList.add('hidden');
    document.getElementById('profileSection').classList.remove('hidden');
    document.getElementById('navbarUserSection').style.display = 'flex';
    document.getElementById('navbarLoginSection').style.display = 'none';
    
    document.getElementById('navbarUserImage').src = profileData.picture;
    document.getElementById('navbarUserName').textContent = profileData.name;
    document.getElementById('navbarUserEmail').textContent = profileData.email;
    
    setupShiftForm();
    
    // デフォルトタブがシフト一覧なので、シフト申請タブの時だけカレンダーを生成
    if (document.querySelector('.tab.active').textContent === 'シフト申請') {
        generateCalendar();
    }
}

async function saveShiftToSpreadsheet(shiftData) {
    const submitBtn = document.querySelector('.submit-btn');
    const originalText = submitBtn.textContent;
    
    try {
        submitBtn.disabled = true;
        submitBtn.textContent = '登録中...';
        
        await fetch(GOOGLE_APPS_SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            mode: 'no-cors',
            body: JSON.stringify({
                type: 'shift',
                userId: currentUser.sub,
                userName: currentUser.name,
                userEmail: currentUser.email,
                date: shiftData.date,
                time: shiftData.time,
                content: shiftData.content
            })
        });
        
        console.log('シフト情報をスプレッドシートに保存しました');
        alert('シフトが正常に登録されました！');
        document.getElementById('shiftForm').reset();
    } catch (error) {
        console.error('シフトの保存に失敗しました:', error);
        alert('シフトの登録に失敗しました。再度お試しください。');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

function setupShiftForm() {
    const form = document.getElementById('shiftForm');
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const formData = new FormData(form);
        const shiftData = {
            date: formData.get('shiftDate'),
            time: formData.get('shiftTime'),
            content: formData.get('shiftContent')
        };
        
        if (!shiftData.date || !shiftData.time || !shiftData.content.trim()) {
            alert('すべての項目を入力してください。');
            return;
        }
        
        saveShiftToSpreadsheet(shiftData);
    });
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
    document.getElementById('loginSection').classList.remove('hidden');
    document.getElementById('profileSection').classList.add('hidden');
    document.getElementById('navbarUserSection').style.display = 'none';
    document.getElementById('navbarLoginSection').style.display = 'block';
    
    document.getElementById('navbarUserImage').src = '';
    document.getElementById('navbarUserName').textContent = '';
    document.getElementById('navbarUserEmail').textContent = '';
    document.getElementById('shiftForm').reset();
    
    console.log('ユーザーがログアウトしました');
}

function switchTab(tabName, clickEvent) {
    // すべてのタブとコンテンツを非アクティブにする
    const tabs = document.querySelectorAll('.tab');
    const contents = document.querySelectorAll('.tab-content');
    
    tabs.forEach(tab => tab.classList.remove('active'));
    contents.forEach(content => content.classList.remove('active'));
    
    // 選択されたタブとコンテンツをアクティブにする
    clickEvent.target.classList.add('active');
    document.getElementById(tabName).classList.add('active');
    
    // シフト申請タブが選択されたらカレンダーを生成
    if (tabName === 'shift-apply' && currentUser) {
        generateCalendar();
    }
}

async function loadShiftInfo() {
    try {
        const response = await fetch(GOOGLE_APPS_SCRIPT_URL + '?type=loadCapacity');
        const data = await response.json();
        
        if (!data.success) {
            console.error('シフト情報の取得に失敗しました:', data.error);
            return null;
        }
        
        console.log('取得したシフト情報:', data.data); // デバッグ用
        shiftInfo = data.data;
        return data.data;
    } catch (error) {
        console.error('シフト情報の取得中にエラーが発生しました:', error);
        return null;
    }
}

async function generateCalendar() {
    const calendarGrid = document.getElementById('calendar-grid');
    calendarGrid.innerHTML = '<p>カレンダーを読み込み中...</p>';
    
    // シフト情報を取得
    const loadedShiftInfo = await loadShiftInfo();
    
    if (!loadedShiftInfo) {
        calendarGrid.innerHTML = '<p>シフト情報の取得に失敗しました。しばらくしてから再度お試しください。</p>';
        return;
    }
    
    calendarGrid.innerHTML = '';
    
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    
    // 来年度の3月末を計算
    const nextYear = currentMonth >= 3 ? currentYear + 1 : currentYear;
    const endDate = new Date(nextYear, 3, 0); // 3月末日
    
    // 今月から来年3月までループ
    let loopDate = new Date(currentYear, currentMonth, 1);
    
    while (loopDate <= endDate) {
        const monthDiv = createMonthCalendar(loopDate.getFullYear(), loopDate.getMonth());
        calendarGrid.appendChild(monthDiv);
        
        // 次の月へ
        loopDate.setMonth(loopDate.getMonth() + 1);
    }
}

function createMonthCalendar(year, month) {
    const monthDiv = document.createElement('div');
    monthDiv.className = 'calendar-month';
    
    // 月のヘッダー
    const header = document.createElement('div');
    header.className = 'calendar-month-header';
    header.textContent = `${year}年${month + 1}月`;
    monthDiv.appendChild(header);
    
    // カレンダーグリッド
    const grid = document.createElement('div');
    grid.className = 'calendar-grid';
    
    // 曜日ヘッダー
    const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
    weekdays.forEach(day => {
        const weekdayDiv = document.createElement('div');
        weekdayDiv.className = 'calendar-weekday';
        weekdayDiv.textContent = day;
        grid.appendChild(weekdayDiv);
    });
    
    // 月の最初の日と最後の日
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const firstDayOfWeek = firstDay.getDay();
    const daysInMonth = lastDay.getDate();
    
    // 前月の空白
    for (let i = 0; i < firstDayOfWeek; i++) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'calendar-day other-month';
        grid.appendChild(emptyDiv);
    }
    
    // 日付を追加
    for (let day = 1; day <= daysInMonth; day++) {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'calendar-day';
        
        const dayOfWeek = new Date(year, month, day).getDay();
        if (dayOfWeek === 0) dayDiv.classList.add('sunday');
        if (dayOfWeek === 6) dayDiv.classList.add('saturday');
        
        const dayNumber = document.createElement('div');
        dayNumber.className = 'calendar-day-number';
        dayNumber.textContent = day;
        dayDiv.appendChild(dayNumber);
        
        // シフト情報を表示
        if (shiftInfo) {
            console.log('shiftInfoの構造:', {
                hasRequiredStaff: !!shiftInfo.requiredStaff,
                hasRegisteredShifts: !!shiftInfo.registeredShifts,
                requiredStaffKeys: shiftInfo.requiredStaff ? Object.keys(shiftInfo.requiredStaff) : [],
                registeredShiftsKeys: shiftInfo.registeredShifts ? Object.keys(shiftInfo.registeredShifts) : []
            });
            
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const shiftContainer = document.createElement('div');
            shiftContainer.className = 'shift-info-container';
            
            // 各時間枠の残り人数を表示
            const timeSlots = ['13:00-13:30', '13:30-14:00', '14:00-14:30', '14:30-15:00', 
                             '15:00-15:30', '15:30-16:00', '16:00-16:30', '16:30-17:00', 
                             '17:00-17:30', '17:30-18:00'];
            
            let hasAvailableSlot = false;
            timeSlots.forEach(slot => {
                const required = (shiftInfo.requiredStaff && shiftInfo.requiredStaff[slot]) || 0;
                const registered = (shiftInfo.registeredShifts && shiftInfo.registeredShifts[dateStr] && 
                                  shiftInfo.registeredShifts[dateStr][slot]) || 0;
                const available = required - registered;
                
                console.log(`${dateStr} ${slot}: required=${required}, registered=${registered}, available=${available}`);
                
                if (available > 0) {
                    hasAvailableSlot = true;
                    const slotDiv = document.createElement('div');
                    slotDiv.className = 'shift-slot-info';
                    slotDiv.textContent = `${slot.split('-')[0]}: 残${available}`;
                    shiftContainer.appendChild(slotDiv);
                }
            });
            
            if (hasAvailableSlot) {
                dayDiv.appendChild(shiftContainer);
                console.log(`${dateStr}に利用可能なスロットを追加しました`);
            } else {
                console.log(`${dateStr}には利用可能なスロットがありませんでした`);
            }
        } else {
            console.log('shiftInfoがnullまたはundefinedです');
        }
        
        // クリックイベント
        dayDiv.addEventListener('click', function(e) {
            selectDate(year, month, day, e);
        });
        
        grid.appendChild(dayDiv);
    }
    
    monthDiv.appendChild(grid);
    return monthDiv;
}

function selectDate(year, month, day, clickEvent) {
    // 以前の選択をクリア
    document.querySelectorAll('.calendar-day.selected').forEach(el => {
        el.classList.remove('selected');
    });
    
    // 新しい日付を選択
    clickEvent.target.closest('.calendar-day').classList.add('selected');
    
    // フォームに日付を設定
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    document.getElementById('shiftDate').value = dateStr;
}

window.onload = function () {
    document.getElementById('g_id_onload').setAttribute('data-client_id', GOOGLE_CLIENT_ID);
    
    google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse
    });
    
    google.accounts.id.renderButton(
        document.getElementById('g_id_navbar_signin'),
        { theme: 'outline', size: 'medium', text: 'signin' }
    );
};