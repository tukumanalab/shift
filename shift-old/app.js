let currentUser = null;
let isAdmin = false;

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    initializeEventListeners();
    populateDateDropdown();
});

function initializeEventListeners() {
    // ログインタイプ切り替えボタン
    document.querySelectorAll('.login-type-btn').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelectorAll('.login-type-btn').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            const type = button.dataset.type;
            // クリックしたログインタイプを記憶
            localStorage.setItem('preferredLoginType', type);
            
            if (type === 'admin') {
                document.getElementById('adminLoginSection').style.display = 'block';
                document.getElementById('userLoginSection').style.display = 'none';
                document.getElementById('userSignupSection').style.display = 'none';
                document.getElementById('adminSignupSection').style.display = 'none';
            } else {
                document.getElementById('adminLoginSection').style.display = 'none';
                document.getElementById('userLoginSection').style.display = 'block';
                document.getElementById('userSignupSection').style.display = 'none';
                document.getElementById('adminSignupSection').style.display = 'none';
            }
        });
    });
    
    // 管理者ログイン
    document.getElementById('adminLoginForm').addEventListener('submit', handleAdminLogin);
    document.getElementById('adminSignupForm').addEventListener('submit', handleAdminSignup);
    document.getElementById('showAdminSignup').addEventListener('click', (e) => {
        e.preventDefault();
        showAdminSignupForm();
    });
    document.getElementById('showAdminLogin').addEventListener('click', (e) => {
        e.preventDefault();
        showAdminLoginForm();
    });
    
    // 一般ユーザーログイン/新規登録
    document.getElementById('userLoginForm').addEventListener('submit', handleUserLogin);
    document.getElementById('userSignupForm').addEventListener('submit', handleUserSignup);
    document.getElementById('showUserSignup').addEventListener('click', (e) => {
        e.preventDefault();
        showUserSignupForm();
    });
    document.getElementById('showUserLogin').addEventListener('click', (e) => {
        e.preventDefault();
        showUserLoginForm();
    });
    
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', () => switchTab(button.dataset.tab));
    });
    
    
    // 旧フォーム用（削除予定）
    // document.getElementById('shiftRequestForm').addEventListener('submit', handleShiftRequest);
    
    // 許容人数設定の保存ボタンのイベントリスナー
    document.getElementById('saveAllCapacities').addEventListener('click', saveAllCapacities);
    
    // シフト申請ボタンのイベントリスナー
    document.getElementById('submitSelectedShifts')?.addEventListener('click', submitSelectedShifts);
    
    // モーダルのイベントリスナー
    document.getElementById('modalCancel')?.addEventListener('click', closeShiftModal);
    document.getElementById('modalSubmit')?.addEventListener('click', confirmShiftRequest);
    
    // Google Calendar連携のイベントリスナー
    document.getElementById('connectGoogleCalendar')?.addEventListener('click', signInToGoogleCalendar);
    document.getElementById('disconnectGoogleCalendar')?.addEventListener('click', signOutFromGoogleCalendar);
    document.getElementById('syncAllShifts')?.addEventListener('click', syncAllShiftsToGoogleCalendar);
    
    // Escキーでモーダルを閉じる
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const modal = document.getElementById('shiftRequestModal');
            if (modal && modal.style.display === 'flex') {
                closeShiftModal();
            }
        }
    });
}

async function checkAuth() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
        currentUser = user;
        await checkAdminStatus();
        showMainContent();
        await updateUserInfo();
        if (isAdmin) {
            // 管理者の場合はシフト管理タブを表示
            switchTab('manage');
            loadAdminData();
        } else {
            loadShifts();
            populateDateDropdown();
            loadShiftRequestTable();
        }
    } else {
        showLastUsedLoginForm();
    }
}

async function checkAdminStatus() {
    try {
        // 管理者はメールアドレス/パスワードでログインしたユーザーで判定
        const { data: { user } } = await supabase.auth.getUser();
        isAdmin = user && user.email && user.email.includes('@');
        
        // 管理者の場合はシフト一覧・シフト申請タブを非表示、シフト管理・設定タブを表示
        const shiftsTabButton = document.querySelector('[data-tab="shifts"]');
        const requestTabButton = document.querySelector('[data-tab="request"]');
        const manageTabButton = document.getElementById('manageTabButton');
        const settingsTabButton = document.getElementById('settingsTabButton');
        if (shiftsTabButton) {
            shiftsTabButton.style.display = isAdmin ? 'none' : 'inline-block';
        }
        if (requestTabButton) {
            requestTabButton.style.display = isAdmin ? 'none' : 'inline-block';
        }
        if (manageTabButton) {
            manageTabButton.style.display = isAdmin ? 'inline-block' : 'none';
        }
        if (settingsTabButton) {
            settingsTabButton.style.display = isAdmin ? 'inline-block' : 'none';
        }
    } catch (error) {
        console.error('管理者ステータスの確認エラー:', error);
    }
}

async function handleAdminLogin(e) {
    e.preventDefault();
    const email = document.getElementById('adminEmail').value;
    const password = document.getElementById('adminPassword').value;
    
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });
        
        if (error) throw error;
        
        currentUser = data.user;
        await checkAdminStatus();
        
        if (!isAdmin) {
            await supabase.auth.signOut();
            alert('管理者権限がありません');
            return;
        }
        
        // 管理者ログイン成功時に記憶
        localStorage.setItem('lastLoginType', 'admin');
        
        showMainContent();
        await updateUserInfo();
        switchTab('manage');
        loadAdminData();
    } catch (error) {
        alert('ログインに失敗しました: ' + error.message);
    }
}

async function handleUserLogin(e) {
    e.preventDefault();
    const userName = document.getElementById('userName').value;
    
    try {
        // 名前でユーザーを検索
        const { data: users, error: searchError } = await supabase
            .from('users')
            .select('id, name')
            .eq('name', userName);
        
        if (searchError) throw searchError;
        
        if (users && users.length > 0) {
            // 既存ユーザーで仮想ログイン（メールアドレスなし）
            const user = users[0];
            
            // 仮想ユーザーオブジェクトを作成
            currentUser = {
                id: user.id,
                email: null, // 一般ユーザーはメールアドレスなし
                user_metadata: {
                    name: user.name
                }
            };
            
            isAdmin = false; // 一般ユーザーは管理者ではない
            
            // 一般ユーザーログイン成功時に記憶
            localStorage.setItem('lastLoginType', 'user');
            
            showMainContent();
            await updateUserInfo();
            loadShifts();
            populateDateDropdown();
            loadShiftRequestTable();
        } else {
            alert('ユーザーが見つかりません。新規登録してください。');
        }
    } catch (error) {
        alert('ログインに失敗しました: ' + error.message);
    }
}

async function handleUserSignup(e) {
    e.preventDefault();
    const userName = document.getElementById('userSignupName').value;
    
    try {
        // 既存ユーザーの確認
        const { data: existingUsers, error: searchError } = await supabase
            .from('users')
            .select('id')
            .eq('name', userName);
        
        if (searchError) throw searchError;
        
        if (existingUsers && existingUsers.length > 0) {
            alert('同じ名前のユーザーが既に存在します。ログインしてください。');
            return;
        }
        
        // 新規ユーザー作成
        const { data, error } = await supabase
            .from('users')
            .insert({
                name: userName
            })
            .select()
            .single();
        
        if (error) throw error;
        
        // 仮想ユーザーオブジェクトを作成
        currentUser = {
            id: data.id,
            email: null,
            user_metadata: {
                name: data.name
            }
        };
        
        isAdmin = false;
        
        // 一般ユーザーログイン成功時に記憶
        localStorage.setItem('lastLoginType', 'user');
        
        alert('登録が完了しました！');
        showMainContent();
        await updateUserInfo();
        loadShifts();
        populateDateDropdown();
        loadShiftRequestTable();
    } catch (error) {
        alert('登録に失敗しました: ' + error.message);
    }
}

async function handleAdminSignup(e) {
    e.preventDefault();
    const name = document.getElementById('adminSignupName').value;
    const email = document.getElementById('adminSignupEmail').value;
    const password = document.getElementById('adminSignupPassword').value;
    
    try {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    name: name
                }
            }
        });
        
        if (error) throw error;
        
        alert('登録が完了しました。メールを確認してください。');
        showLastUsedLoginForm();
    } catch (error) {
        alert('登録に失敗しました: ' + error.message);
    }
}

async function handleShiftRequest(e) {
    e.preventDefault();
    const date = document.getElementById('requestDate').value;
    const note = document.getElementById('requestNote').value;
    
    // チェックされた時間帯を取得
    const checkedTimeSlots = [];
    const checkboxes = document.querySelectorAll('input[name="timeSlot"]:checked');
    checkboxes.forEach(checkbox => {
        checkedTimeSlots.push(checkbox.value);
    });
    
    if (checkedTimeSlots.length === 0) {
        alert('少なくとも1つの時間帯を選択してください。');
        return;
    }
    
    // 土日チェックは不要（プルダウンで平日のみ選択可能）
    
    try {
        // 日付の許容人数をチェック
        const selectedDate = new Date(date);
        const dayOfWeek = selectedDate.getDay();
        
        // 土日の場合は警告を表示
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            const confirmMessage = `${formatDate(date)}は土日のため、通常はシフトがありません。\n\n申請を続行しますか？`;
            if (!confirm(confirmMessage)) {
                return;
            }
        }
        
        const { data: capacityData, error: capacityError } = await supabase
            .rpc('check_shift_capacity', {
                p_date: date
            });
        
        if (capacityError) {
            console.error('許容人数チェックエラー:', capacityError);
        } else if (!capacityData) {
            const confirmMessage = `${formatDate(date)}は許容人数に達している可能性があります。\n\n申請を続行しますか？`;
            if (!confirm(confirmMessage)) {
                return;
            }
        }
        
        // 選択された各時間帯に対して申請を作成
        const insertData = checkedTimeSlots.map(timeSlot => ({
            user_id: currentUser.id,
            date: date,
            time_slot: timeSlot,
            note: note
        }));
        
        const { data, error } = await supabase
            .from('shifts')
            .insert(insertData);
        
        if (error) throw error;
        
        // Google Calendar連携
        if (typeof handleShiftCreatedForGoogleCalendar !== 'undefined') {
            await handleShiftCreatedForGoogleCalendar(data || insertData);
        }
        
        alert(`${checkedTimeSlots.length}件のシフト希望を申請しました`);
        document.getElementById('shiftRequestForm').reset();
        loadShifts();
        loadUserShifts();
    } catch (error) {
        alert('申請に失敗しました: ' + error.message);
    }
}

async function loadShifts() {
    try {
        // 自分のすべてのシフトを表示
        const { data, error } = await supabase
            .from('shifts')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('date', { ascending: true });
        
        if (error) throw error;
        
        displayShiftsCalendar(data || []);
    } catch (error) {
        console.error('シフトの読み込みに失敗しました:', error);
    }
}


function displayShiftsCalendar(shifts) {
    const tableBody = document.getElementById('shiftListTableBody');
    tableBody.innerHTML = '';
    
    if (shifts.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td colspan="2" class="no-shifts-message">
                シフトがありません
            </td>
        `;
        tableBody.appendChild(row);
        return;
    }
    
    // 日付でグループ化
    const shiftsByDate = {};
    shifts.forEach(shift => {
        const dateStr = shift.date;
        if (!shiftsByDate[dateStr]) {
            shiftsByDate[dateStr] = [];
        }
        shiftsByDate[dateStr].push(shift);
    });
    
    // 日付順にソート
    const sortedDates = Object.keys(shiftsByDate).sort();
    
    // 月ごとにグループ化
    const shiftsByMonth = {};
    sortedDates.forEach(dateStr => {
        const date = new Date(dateStr + 'T12:00:00');
        const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
        if (!shiftsByMonth[monthKey]) {
            shiftsByMonth[monthKey] = [];
        }
        shiftsByMonth[monthKey].push(dateStr);
    });
    
    // 月ごとに表示
    Object.keys(shiftsByMonth).sort().forEach(monthKey => {
        const [year, month] = monthKey.split('-');
        
        // 月セクションヘッダー
        const monthHeaderRow = document.createElement('tr');
        monthHeaderRow.className = 'month-section-header';
        monthHeaderRow.innerHTML = `
            <td colspan="2" class="month-header">
                ${year}年${parseInt(month)}月
            </td>
        `;
        tableBody.appendChild(monthHeaderRow);
        
        // その月の日付を表示
        shiftsByMonth[monthKey].forEach(dateStr => {
            const shiftsForDate = shiftsByDate[dateStr];
            const date = new Date(dateStr + 'T12:00:00');
            const dayOfWeek = date.getDay();
            const isSunday = dayOfWeek === 0;
            const isSaturday = dayOfWeek === 6;
            
            const row = document.createElement('tr');
            let rowClass = 'weekday-row';
            if (isSunday) {
                rowClass = 'sunday-row';
            } else if (isSaturday) {
                rowClass = 'saturday-row';
            }
            row.className = rowClass;
            
            // 日付セル
            const dateCell = document.createElement('td');
            dateCell.className = 'date-cell';
            dateCell.innerHTML = `
                <div class="date-display">
                    <div class="date-number">${date.getDate()}</div>
                    <div class="day-label">${getDayLabel(dayOfWeek)}</div>
                </div>
            `;
            
            // シフトセル
            const shiftsCell = document.createElement('td');
            shiftsCell.className = 'time-slots-cell';
            
            const slotsContainer = document.createElement('div');
            slotsContainer.className = 'slots-container';
            
            // time_slotで昇順ソート（13:00-13:30, 13:30-14:00, ...の順）
            shiftsForDate.sort((a, b) => {
                return a.time_slot.localeCompare(b.time_slot);
            });
            
            shiftsForDate.forEach(shift => {
                const shiftSlot = document.createElement('div');
                shiftSlot.className = 'shift-slot confirmed';
                shiftSlot.innerHTML = `
                    <div class="time-label">${getTimeSlotLabel(shift.time_slot)}</div>
                    <div class="status-label">申請済み</div>
                    ${shift.note ? `<div class="shift-note">${shift.note}</div>` : ''}
                `;
                slotsContainer.appendChild(shiftSlot);
            });
            
            shiftsCell.appendChild(slotsContainer);
            
            row.appendChild(dateCell);
            row.appendChild(shiftsCell);
            tableBody.appendChild(row);
        });
    });
}

async function loadAdminData() {
    try {
        // まずシフトデータを取得
        const { data: shiftsData, error: shiftsError } = await supabase
            .from('shifts')
            .select('*')
            .order('date', { ascending: false });
        
        if (shiftsError) throw shiftsError;
        
        // ユニークなユーザーIDを取得
        const userIds = [...new Set(shiftsData.map(shift => shift.user_id))];
        
        // usersテーブルからユーザー情報を取得
        const { data: usersData, error: usersError } = await supabase
            .from('users')
            .select('id, name')
            .in('id', userIds);
        
        if (usersError) {
            console.error('ユーザーデータ取得エラー:', usersError);
        }
        
        // 許容人数情報を取得
        const { data: capacityData, error: capacityError } = await supabase
            .from('shift_capacity')
            .select('*');
        
        if (capacityError) {
            console.error('許容人数データ取得エラー:', capacityError);
        }
        
        // ユーザー情報をマップに変換
        const usersMap = {};
        if (usersData) {
            usersData.forEach(user => {
                usersMap[user.id] = user.name;
            });
        }
        
        // 許容人数情報をマップに変換
        const capacityMap = {};
        if (capacityData) {
            capacityData.forEach(capacity => {
                capacityMap[capacity.date] = capacity.max_capacity;
            });
        }
        
        // シフトデータにユーザー名と許容人数情報を追加
        const shiftsWithUsers = shiftsData.map(shift => ({
            ...shift,
            users: {
                name: usersMap[shift.user_id] || `ユーザー${shift.user_id.slice(-8)}`
            },
            capacity: capacityMap[shift.date] || 1
        }));
        
        displayAdminCalendar(shiftsWithUsers);
    } catch (error) {
        console.error('管理者用シフトの読み込みに失敗しました:', error);
    }
}

function displayAdminCalendar(shifts) {
    const adminCalendar = document.getElementById('adminCalendar');
    if (!adminCalendar) {
        console.error('adminCalendar要素が見つかりません');
        return;
    }
    
    // カレンダー表示の日付範囲を設定（今日から1ヶ月間）
    const today = new Date();
    const endDate = new Date(today);
    endDate.setMonth(endDate.getMonth() + 1);
    
    // 月ごとにカレンダーを生成
    const monthsToShow = [];
    const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    while (currentMonth <= endDate) {
        monthsToShow.push(new Date(currentMonth));
        currentMonth.setMonth(currentMonth.getMonth() + 1);
    }
    
    adminCalendar.innerHTML = '';
    
    monthsToShow.forEach(monthDate => {
        const monthDiv = document.createElement('div');
        monthDiv.className = 'admin-calendar-month';
        
        // 月ヘッダー
        const monthHeader = document.createElement('div');
        monthHeader.className = 'admin-calendar-month-header';
        monthHeader.textContent = `${monthDate.getFullYear()}年${monthDate.getMonth() + 1}月`;
        
        // カレンダーグリッド
        const calendarGrid = document.createElement('div');
        calendarGrid.className = 'admin-calendar-grid';
        
        // 曜日ヘッダー（月曜日始まり）
        const dayHeaders = ['月', '火', '水', '木', '金', '土', '日'];
        dayHeaders.forEach(day => {
            const dayHeader = document.createElement('div');
            dayHeader.className = 'admin-calendar-day-header';
            dayHeader.textContent = day;
            calendarGrid.appendChild(dayHeader);
        });
        
        // 月の日数と開始曜日を計算
        const year = monthDate.getFullYear();
        const month = monthDate.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startDayOfWeek = firstDay.getDay();
        
        // 空のセルを追加（月の始まりまで）
        // 月曜日始まりに調整: 日曜日(0)は6、月曜日(1)は0になる
        const adjustedStartDay = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;
        for (let i = 0; i < adjustedStartDay; i++) {
            const emptyCell = document.createElement('div');
            emptyCell.className = 'admin-calendar-empty-cell';
            calendarGrid.appendChild(emptyCell);
        }
        
        // 各日のセルを作成
        for (let day = 1; day <= lastDay.getDate(); day++) {
            const date = new Date(year, month, day);
            const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
            const dayOfWeek = date.getDay();
            const isSunday = dayOfWeek === 0;
            const isSaturday = dayOfWeek === 6;
            const isWeekend = isSunday || isSaturday;
            
            const dayCell = document.createElement('div');
            let cellClass = 'admin-calendar-date-cell';
            if (isSunday) {
                cellClass += ' sunday';
            } else if (isSaturday) {
                cellClass += ' saturday';
            } else {
                cellClass += ' weekday';
            }
            dayCell.className = cellClass;
            
            // 日付番号
            const dateNumber = document.createElement('div');
            dateNumber.className = 'admin-calendar-date-number';
            dateNumber.textContent = day;
            
            // その日のシフトを取得
            const dayShifts = shifts.filter(shift => shift.date === dateStr);
            
            // シフト情報を表示
            const shiftsContainer = document.createElement('div');
            shiftsContainer.className = 'admin-calendar-shifts';
            
            if (dayShifts.length > 0) {
                // まずユーザーごとにグループ化
                const shiftsByUser = {};
                dayShifts.forEach(shift => {
                    const userName = shift.users?.name || 'ユーザー不明';
                    if (!shiftsByUser[userName]) {
                        shiftsByUser[userName] = [];
                    }
                    shiftsByUser[userName].push(shift);
                });
                
                // ユーザー名でソート
                const sortedUsers = Object.keys(shiftsByUser).sort();
                
                sortedUsers.forEach(userName => {
                    // 各ユーザーのシフトを時間順にソート
                    shiftsByUser[userName].sort((a, b) => {
                        return a.time_slot.localeCompare(b.time_slot);
                    });
                    
                    shiftsByUser[userName].forEach(shift => {
                        const shiftItem = document.createElement('div');
                        shiftItem.className = 'admin-calendar-shift-item';
                        shiftItem.innerHTML = `
                            <div class="admin-shift-user">${shift.users?.name || 'ユーザー不明'}</div>
                            <div class="admin-shift-time">${getTimeSlotLabel(shift.time_slot)}</div>
                            <button class="admin-shift-delete" onclick="deleteShift('${shift.id}')" title="削除">×</button>
                        `;
                        shiftsContainer.appendChild(shiftItem);
                    });
                });
            }
            
            dayCell.appendChild(dateNumber);
            dayCell.appendChild(shiftsContainer);
            calendarGrid.appendChild(dayCell);
        }
        
        monthDiv.appendChild(monthHeader);
        monthDiv.appendChild(calendarGrid);
        adminCalendar.appendChild(monthDiv);
    });
}

async function loadUserShifts() {
    try {
        const { data, error } = await supabase
            .from('shifts')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('date', { ascending: true });
        
        if (error) throw error;
        
        displayUserShifts(data || []);
    } catch (error) {
        console.error('ユーザーシフトの読み込みに失敗しました:', error);
    }
}

function displayUserShifts(shifts) {
    const requestsContent = document.getElementById('requestsContent');
    requestsContent.innerHTML = '';
    
    if (shifts.length === 0) {
        requestsContent.innerHTML = '<p>申請がありません</p>';
        return;
    }
    
    shifts.forEach(shift => {
        const shiftItem = document.createElement('div');
        shiftItem.className = 'request-item';
        shiftItem.innerHTML = `
            <div>
                <strong>${formatDate(shift.date)}</strong>
                <span>${getTimeSlotLabel(shift.time_slot)}</span>
                ${shift.note ? `<p>${shift.note}</p>` : ''}
            </div>
        `;
        requestsContent.appendChild(shiftItem);
    });
}





function switchTab(tabName) {
    
    // 管理者がシフト申請タブにアクセスしようとした場合はリダイレクト
    if (isAdmin && tabName === 'request') {
        switchTab('shifts');
        return;
    }
    
    document.querySelectorAll('.tab-button').forEach(button => {
        button.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    
    document.querySelectorAll('.tab-content').forEach(content => {
        content.style.display = 'none';
    });
    
    const targetTab = document.getElementById(`${tabName}Tab`);
    targetTab.style.display = 'block';
    
    if (tabName === 'request') {
        loadUserShifts();
        // タブ切り替え時に選択状態をリセット
        selectedShifts.clear();
        updateSelectedCount();
    } else if (tabName === 'manage' && isAdmin) {
        loadAdminData();
    } else if (tabName === 'settings' && isAdmin) {
        loadCapacityCalendar();
    }
}

function showAdminLoginForm() {
    document.querySelector('.login-type-selector').style.display = 'block';
    document.getElementById('adminLoginSection').style.display = 'block';
    document.getElementById('adminSignupSection').style.display = 'none';
    document.getElementById('userLoginSection').style.display = 'none';
    document.getElementById('userSignupSection').style.display = 'none';
    document.getElementById('mainContent').style.display = 'none';
    
    // 管理者ボタンをアクティブに
    document.querySelectorAll('.login-type-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector('[data-type="admin"]').classList.add('active');
}

function showAdminSignupForm() {
    document.querySelector('.login-type-selector').style.display = 'block';
    document.getElementById('adminLoginSection').style.display = 'none';
    document.getElementById('adminSignupSection').style.display = 'block';
    document.getElementById('userLoginSection').style.display = 'none';
    document.getElementById('userSignupSection').style.display = 'none';
    document.getElementById('mainContent').style.display = 'none';
}

function showUserLoginForm() {
    document.querySelector('.login-type-selector').style.display = 'block';
    document.getElementById('adminLoginSection').style.display = 'none';
    document.getElementById('adminSignupSection').style.display = 'none';
    document.getElementById('userLoginSection').style.display = 'block';
    document.getElementById('userSignupSection').style.display = 'none';
    document.getElementById('mainContent').style.display = 'none';
    
    // 一般ユーザーボタンをアクティブに
    document.querySelectorAll('.login-type-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector('[data-type="user"]').classList.add('active');
}

function showUserSignupForm() {
    document.querySelector('.login-type-selector').style.display = 'block';
    document.getElementById('adminLoginSection').style.display = 'none';
    document.getElementById('adminSignupSection').style.display = 'none';
    document.getElementById('userLoginSection').style.display = 'none';
    document.getElementById('userSignupSection').style.display = 'block';
    document.getElementById('mainContent').style.display = 'none';
    
    // 一般ユーザーボタンをアクティブに
    document.querySelectorAll('.login-type-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector('[data-type="user"]').classList.add('active');
}

function showLastUsedLoginForm() {
    // 最後に成功したログイン方法、または手動で選択された方法を優先
    const lastLoginType = localStorage.getItem('lastLoginType');
    const preferredLoginType = localStorage.getItem('preferredLoginType');
    
    // 優先順位: 手動選択 > 最後のログイン成功 > デフォルト(admin)
    const loginType = preferredLoginType || lastLoginType || 'admin';
    
    if (loginType === 'user') {
        showUserLoginForm();
    } else {
        showAdminLoginForm();
    }
}

function showMainContent() {
    document.querySelector('.login-type-selector').style.display = 'none';
    document.getElementById('adminLoginSection').style.display = 'none';
    document.getElementById('adminSignupSection').style.display = 'none';
    document.getElementById('userLoginSection').style.display = 'none';
    document.getElementById('userSignupSection').style.display = 'none';
    document.getElementById('mainContent').style.display = 'block';
}

async function updateUserInfo() {
    const userInfo = document.getElementById('userInfo');
    if (currentUser) {
        const adminBadge = isAdmin ? '<span class="admin-badge">管理者</span>' : '';
        
        // usersテーブルからユーザー名を取得
        let userName = currentUser.email; // デフォルトはメールアドレス
        try {
            const { data, error } = await supabase
                .from('users')
                .select('name')
                .eq('id', currentUser.id)
                .single();
            
            if (data && data.name) {
                userName = data.name;
            }
        } catch (error) {
            console.error('ユーザー名取得エラー:', error);
        }
        
        userInfo.innerHTML = `
            ${userName}
            ${adminBadge}
            <button onclick="logout()">ログアウト</button>
        `;
    } else {
        userInfo.innerHTML = '';
    }
}

async function logout() {
    await supabase.auth.signOut();
    currentUser = null;
    isAdmin = false;
    updateUserInfo();
    showLastUsedLoginForm();
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function getTimeSlotLabel(timeSlot) {
    const labels = {
        '13:00-13:30': '13:00-13:30',
        '13:30-14:00': '13:30-14:00',
        '14:00-14:30': '14:00-14:30',
        '14:30-15:00': '14:30-15:00',
        '15:00-15:30': '15:00-15:30',
        '15:30-16:00': '15:30-16:00',
        '16:00-16:30': '16:00-16:30',
        '16:30-17:00': '16:30-17:00',
        '17:00-17:30': '17:00-17:30',
        '17:30-18:00': '17:30-18:00'
    };
    return labels[timeSlot] || timeSlot;
}

function getDayLabel(dayOfWeek) {
    const labels = ['日', '月', '火', '水', '木', '金', '土'];
    return labels[dayOfWeek] || '';
}

async function deleteShift(shiftId) {
    if (!confirm('このシフトを削除しますか？')) {
        return;
    }
    
    try {
        // まずシフト情報を取得（Google Calendar Event IDを含む）
        const { data: shiftData, error: fetchError } = await supabase
            .from('shifts')
            .select('*')
            .eq('id', shiftId)
            .single();
        
        if (fetchError) throw fetchError;
        
        // Google Calendar連携
        if (typeof handleShiftDeletedForGoogleCalendar !== 'undefined') {
            await handleShiftDeletedForGoogleCalendar(shiftData);
        }
        
        const { error } = await supabase
            .from('shifts')
            .delete()
            .eq('id', shiftId);
        
        if (error) throw error;
        
        alert('シフトを削除しました');
        loadAdminData();
    } catch (error) {
        alert('削除に失敗しました: ' + error.message);
    }
}

function populateDateDropdown() {
    const dateSelect = document.getElementById('requestDate');
    if (!dateSelect) return;
    
    dateSelect.innerHTML = '<option value="">日付を選択してください</option>';
    
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    
    // 今月の残りの平日（今日以降）
    addWeekdaysToDropdown(dateSelect, currentYear, currentMonth, today.getDate() + 1);
    
    // 来月の平日
    const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
    const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
    addWeekdaysToDropdown(dateSelect, nextYear, nextMonth, 1);
}

function addWeekdaysToDropdown(selectElement, year, month, startDay) {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
    
    for (let day = startDay; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const dayOfWeek = date.getDay();
        
        const option = document.createElement('option');
        const dateValue = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        option.value = dateValue;
        
        const weekDays = ['日', '月', '火', '水', '木', '金', '土'];
        const dayLabel = weekDays[dayOfWeek];
        const weekendMark = (dayOfWeek === 0 || dayOfWeek === 6) ? ' 🔴' : '';
        option.textContent = `${monthNames[month]}${day}日 (${dayLabel})${weekendMark}`;
        
        selectElement.appendChild(option);
    }
}

// 許容人数カレンダーの処理
async function loadCapacityCalendar() {
    try {
        // 既存の許容人数設定を取得
        const { data: existingCapacities, error } = await supabase
            .from('shift_capacity')
            .select('*')
            .order('date', { ascending: true });
        
        if (error) throw error;
        
        // 既存設定をマップに変換
        const capacityMap = {};
        (existingCapacities || []).forEach(capacity => {
            capacityMap[capacity.date] = capacity.max_capacity;
        });
        
        
        displayCapacityCalendar(capacityMap);
    } catch (error) {
        console.error('許容人数設定の読み込みに失敗しました:', error);
    }
}

function displayCapacityCalendar(capacityMap) {
    const capacityCalendar = document.getElementById('capacityCalendar');
    capacityCalendar.innerHTML = '';
    
    // 共通の日付範囲を取得
    const { startDate: today, endDate: oneMonthFromNow } = getDateRange();
    
    // 月別にグループ化
    const monthsData = [];
    const currentMonth = today.getMonth();
    const nextMonth = (currentMonth + 1) % 12;
    
    // 今月と来月の情報を取得
    const thisYear = today.getFullYear();
    const nextYear = nextMonth === 0 ? thisYear + 1 : thisYear;
    
    monthsData.push({
        year: thisYear,
        month: currentMonth,
        startDate: new Date(today),
        endDate: new Date(thisYear, currentMonth + 1, 0)
    });
    
    if (nextMonth !== currentMonth) {
        monthsData.push({
            year: nextYear,
            month: nextMonth,
            startDate: new Date(nextYear, nextMonth, 1),
            endDate: new Date(oneMonthFromNow)
        });
    }
    
    monthsData.forEach(monthData => {
        const monthContainer = document.createElement('div');
        monthContainer.className = 'calendar-month';
        
        const monthHeader = document.createElement('div');
        monthHeader.className = 'calendar-month-header';
        monthHeader.innerHTML = `${monthData.year}年 ${monthData.month + 1}月`;
        monthContainer.appendChild(monthHeader);
        
        const calendarGrid = document.createElement('div');
        calendarGrid.className = 'calendar-grid';
        
        // 曜日ヘッダー
        const weekdays = ['月', '火', '水', '木', '金', '土', '日'];
        weekdays.forEach(day => {
            const dayHeader = document.createElement('div');
            dayHeader.className = 'calendar-day-header';
            dayHeader.textContent = day;
            calendarGrid.appendChild(dayHeader);
        });
        
        // 月の最初の日の曜日を取得（月曜日を0とする）
        const firstDay = new Date(monthData.year, monthData.month, 1);
        const firstDayOfWeek = (firstDay.getDay() + 6) % 7; // 日曜日を6、月曜日を0に変換
        
        // 最初の週の空セルを追加
        for (let i = 0; i < firstDayOfWeek; i++) {
            const emptyCell = document.createElement('div');
            emptyCell.className = 'calendar-empty-cell';
            calendarGrid.appendChild(emptyCell);
        }
        
        // 日付セルを追加
        const maxDate = monthData.endDate.getDate();
        const startDate = monthData.startDate.getDate();
        
        for (let day = 1; day <= maxDate; day++) {
            // タイムゾーン問題を避けるため、直接日付文字列を生成
            const dateStr = `${monthData.year}-${(monthData.month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
            const currentDate = new Date(dateStr + 'T12:00:00');
            
            
            // タイムゾーン問題を回避するため、dateStrから再度曜日を計算
            const dateFromStr = new Date(dateStr + 'T12:00:00');
            const actualDayOfWeek = dateFromStr.getDay();
            
            // 今日より前、または1ヶ月先以降の日付をスキップ
            const todayStr = today.toISOString().split('T')[0];
            const endDateStr = oneMonthFromNow.toISOString().split('T')[0];
            const currentDateStr = currentDate.toISOString().split('T')[0];
            if (currentDateStr < todayStr || currentDateStr >= endDateStr) {
                // 空セルを追加
                const emptyCell = document.createElement('div');
                emptyCell.className = 'calendar-empty-cell';
                calendarGrid.appendChild(emptyCell);
                continue;
            }
            
            // 土日は0人、平日は1人をデフォルトに（actualDayOfWeekを使用）
            const defaultCapacity = (actualDayOfWeek === 0 || actualDayOfWeek === 6) ? 0 : 1;
            const currentCapacity = capacityMap[dateStr] !== undefined ? capacityMap[dateStr] : defaultCapacity;
            
            
            const dateCell = document.createElement('div');
            let cellClass = 'calendar-date-cell';
            if (actualDayOfWeek === 0) {
                cellClass += ' sunday';
            } else if (actualDayOfWeek === 6) {
                cellClass += ' saturday';
            } else {
                cellClass += ' weekday';
            }
            dateCell.className = cellClass;
            
            dateCell.innerHTML = `
                <div class="calendar-date-number">${day}</div>
                <div class="calendar-capacity-input">
                    <input 
                        type="number" 
                        id="capacity_${dateStr}" 
                        class="capacity-input" 
                        min="0" 
                        max="10" 
                        value="${currentCapacity}"
                        data-date="${dateStr}"
                        title="許容人数"
                        autocomplete="off"
                    >
                    <span class="capacity-unit">人</span>
                </div>
            `;
            
            calendarGrid.appendChild(dateCell);
            
        }
        
        monthContainer.appendChild(calendarGrid);
        capacityCalendar.appendChild(monthContainer);
    });
}

function getDayOfWeekLabel(dayOfWeek) {
    const labels = ['日', '月', '火', '水', '木', '金', '土'];
    return labels[dayOfWeek];
}

async function saveAllCapacities() {
    const inputs = document.querySelectorAll('.capacity-input');
    const updates = [];
    
    inputs.forEach(input => {
        const date = input.dataset.date;
        const capacity = parseInt(input.value);
        
        if (capacity >= 0) {
            updates.push({
                date: date,
                max_capacity: capacity
            });
        }
    });
    
    if (updates.length === 0) {
        alert('保存する設定がありません');
        return;
    }
    
    try {
        // 各日付について個別に処理
        for (const update of updates) {
            // 既存のレコードを確認
            const { data: existing } = await supabase
                .from('shift_capacity')
                .select('id')
                .eq('date', update.date)
                .single();
            
            if (existing) {
                // 既存のレコードを更新
                const { error } = await supabase
                    .from('shift_capacity')
                    .update({ max_capacity: update.max_capacity })
                    .eq('date', update.date);
                
                if (error) throw error;
            } else {
                // 新しいレコードを挿入
                const { error } = await supabase
                    .from('shift_capacity')
                    .insert(update);
                
                if (error) throw error;
            }
        }
        
        alert(`${updates.length}件の許容人数設定を保存しました`);
        loadCapacityCalendar(); // 再読み込み
    } catch (error) {
        alert('設定の保存に失敗しました: ' + error.message);
    }
}

// 共通の日付範囲計算関数
function getDateRange() {
    const today = new Date();
    const endDate = new Date(today);
    endDate.setMonth(endDate.getMonth() + 1);
    return {
        startDate: today,
        endDate: endDate
    };
}

// 選択されたシフトを管理する変数
let selectedShifts = new Set();

// 新しいシフト申請テーブル機能
async function loadShiftRequestTable() {
    // 選択状態をリセット
    selectedShifts.clear();
    updateSelectedCount();
    try {
        // 共通の日付範囲を取得
        const { startDate, endDate } = getDateRange();
        
        // 日別許容人数データを取得
        const { data: capacityData, error: capacityError } = await supabase
            .from('shift_capacity')
            .select('*')
            .gte('date', startDate.toISOString().split('T')[0])
            .lt('date', endDate.toISOString().split('T')[0])
            .order('date');
        
        if (capacityError) {
            console.error('許容人数データ取得エラー:', capacityError);
        }
        
        
        // 既存のシフト申請データを取得
        const { data: shiftsData, error: shiftsError } = await supabase
            .from('shifts')
            .select('*')
            .gte('date', startDate.toISOString().split('T')[0])
            .lt('date', endDate.toISOString().split('T')[0]);
        
        if (shiftsError) {
            console.error('シフトデータ取得エラー:', shiftsError);
        }
        
        generateShiftRequestTable(startDate, endDate, capacityData || [], shiftsData || []);
    } catch (error) {
        console.error('シフト申請テーブル読み込みエラー:', error);
    }
}

function generateShiftRequestTable(startDate, endDate, capacityData, shiftsData) {
    const tbody = document.getElementById('shiftRequestTableBody');
    tbody.innerHTML = '';
    
    // 許容人数をマップに変換
    const capacityMap = {};
    capacityData.forEach(capacity => {
        capacityMap[capacity.date] = capacity.max_capacity;
    });
    
    
    // 既存シフトを日付・時間帯別にカウント
    const shiftCountMap = {};
    shiftsData.forEach(shift => {
        const key = `${shift.date}_${shift.time_slot}`;
        shiftCountMap[key] = (shiftCountMap[key] || 0) + 1;
    });
    
    // capacityDataに基づいて日付を生成（存在するデータのみ表示）
    const availableDates = capacityData.map(item => item.date).sort();
    
    // 月ごとにグループ化
    const datesByMonth = {};
    availableDates.forEach(dateStr => {
        const date = new Date(dateStr + 'T12:00:00');
        const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
        if (!datesByMonth[monthKey]) {
            datesByMonth[monthKey] = [];
        }
        datesByMonth[monthKey].push(dateStr);
    });
    
    // 月ごとに表示
    Object.keys(datesByMonth).sort().forEach(monthKey => {
        const [year, month] = monthKey.split('-');
        
        // 月セクションヘッダー
        const monthHeaderRow = document.createElement('tr');
        monthHeaderRow.className = 'month-section-header';
        monthHeaderRow.innerHTML = `
            <td colspan="2" class="month-header">
                ${year}年${parseInt(month)}月
            </td>
        `;
        tbody.appendChild(monthHeaderRow);
        
        // その月の日付を表示
        datesByMonth[monthKey].forEach(dateStr => {
        // タイムゾーン問題を回避するため正午の時刻を使用
        const currentDate = new Date(dateStr + 'T12:00:00');
        const dayOfWeek = currentDate.getDay();
        const dayLabel = ['日', '月', '火', '水', '木', '金', '土'][dayOfWeek];
        const isSunday = dayOfWeek === 0;
        const isSaturday = dayOfWeek === 6;
        
        const maxCapacity = capacityMap[dateStr] || 0;
        
        
        const row = document.createElement('tr');
        let rowClass = 'weekday-row';
        if (isSunday) {
            rowClass = 'sunday-row';
        } else if (isSaturday) {
            rowClass = 'saturday-row';
        }
        row.className = rowClass;
        
        // 日付列
        const dateCell = document.createElement('td');
        dateCell.className = 'date-cell';
        dateCell.innerHTML = `
            <div class="date-display">
                <span class="date-number">${currentDate.getDate()}</span>
                <span class="day-label">${dayLabel}</span>
            </div>
        `;
        row.appendChild(dateCell);
        
        // シフト枠列
        const slotsCell = document.createElement('td');
        slotsCell.className = 'time-slots-cell';
        
        const timeSlots = [
            '13:00-13:30', '13:30-14:00', '14:00-14:30', '14:30-15:00',
            '15:00-15:30', '15:30-16:00', '16:00-16:30', '16:30-17:00',
            '17:00-17:30', '17:30-18:00'
        ];
        
        const slotsContainer = document.createElement('div');
        slotsContainer.className = 'slots-container';
        
        timeSlots.forEach(timeSlot => {
            const slotKey = `${dateStr}_${timeSlot}`;
            const currentCount = shiftCountMap[slotKey] || 0;
            const remainingSlots = Math.max(0, maxCapacity - currentCount);
            
            const slotButton = document.createElement('button');
            slotButton.className = 'shift-slot';
            
            // 時間帯と申請済み人数/許容人数を表示
            slotButton.innerHTML = `
                <span class="time-label">${timeSlot}</span>
                <span class="remaining-count">${currentCount}/${maxCapacity}</span>
            `;
            
            if (maxCapacity === 0) {
                // 許容人数が0の場合
                slotButton.classList.add('no-capacity');
                slotButton.disabled = true;
                slotButton.innerHTML = `
                    <span class="time-label">${timeSlot}</span>
                    <span class="remaining-count">申請不可</span>
                `;
            } else if (remainingSlots === 0) {
                // 枠が埋まっている場合
                slotButton.classList.add('full');
                slotButton.disabled = true;
            } else {
                // 申請可能な場合
                slotButton.classList.add('available');
                const slotId = `${dateStr}_${timeSlot}`;
                slotButton.dataset.slotId = slotId;
                slotButton.onclick = () => toggleShiftSelection(slotId, dateStr, timeSlot);
                
                // 既に選択されている場合
                if (selectedShifts.has(slotId)) {
                    slotButton.classList.add('selected');
                }
            }
            
            slotsContainer.appendChild(slotButton);
        });
        
        slotsCell.appendChild(slotsContainer);
        row.appendChild(slotsCell);
        
        tbody.appendChild(row);
        });
    });
}

// シフトの選択状態を切り替える
function toggleShiftSelection(slotId, date, timeSlot) {
    const button = document.querySelector(`[data-slot-id="${slotId}"]`);
    
    if (selectedShifts.has(slotId)) {
        selectedShifts.delete(slotId);
        button.classList.remove('selected');
    } else {
        selectedShifts.add(slotId);
        button.classList.add('selected');
    }
    
    updateSelectedCount();
}

// 選択数を更新
function updateSelectedCount() {
    const count = selectedShifts.size;
    document.getElementById('selectedCount').textContent = `${count}件選択中`;
    document.getElementById('submitSelectedShifts').disabled = count === 0;
}

// 選択されたシフトをまとめて申請（モーダルを表示）
function submitSelectedShifts() {
    if (!currentUser) {
        alert('ログインが必要です');
        return;
    }
    
    if (selectedShifts.size === 0) {
        alert('シフトを選択してください');
        return;
    }
    
    // モーダルを表示
    document.getElementById('modalMessage').textContent = `${selectedShifts.size}件のシフトを申請します。`;
    document.getElementById('shiftNote').value = '';
    document.getElementById('shiftRequestModal').style.display = 'flex';
}

// モーダルを閉じる
function closeShiftModal() {
    document.getElementById('shiftRequestModal').style.display = 'none';
}

// シフト申請を実行
async function confirmShiftRequest() {
    const note = document.getElementById('shiftNote').value || '';
    
    try {
        // 選択されたシフトをパースして申請データを作成
        const shiftsToInsert = Array.from(selectedShifts).map(slotId => {
            const [date, ...timeSlotParts] = slotId.split('_');
            const timeSlot = timeSlotParts.join('_');
            return {
                user_id: currentUser.id,
                date: date,
                time_slot: timeSlot,
                note: note
            };
        });
        
        // バッチ挿入
        const { data, error } = await supabase
            .from('shifts')
            .insert(shiftsToInsert);
        
        if (error) throw error;
        
        // Google Calendar連携
        if (typeof handleShiftCreatedForGoogleCalendar !== 'undefined') {
            await handleShiftCreatedForGoogleCalendar(data || shiftsToInsert);
        }
        
        closeShiftModal();
        alert(`${selectedShifts.size}件のシフト申請が完了しました`);
        loadShiftRequestTable(); // テーブルを再読み込み
        loadShifts(); // シフト一覧も更新
    } catch (error) {
        alert('シフト申請に失敗しました: ' + error.message);
    }
}

window.logout = logout;
window.deleteShift = deleteShift;
