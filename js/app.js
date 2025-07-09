let currentUser = null;
let isAdmin = false;

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    initializeEventListeners();
    populateDateDropdown();
});

function initializeEventListeners() {
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('signupForm').addEventListener('submit', handleSignup);
    document.getElementById('showSignup').addEventListener('click', (e) => {
        e.preventDefault();
        showSignupForm();
    });
    document.getElementById('showLogin').addEventListener('click', (e) => {
        e.preventDefault();
        showLoginForm();
    });
    
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', () => switchTab(button.dataset.tab));
    });
    
    
    document.getElementById('shiftRequestForm').addEventListener('submit', handleShiftRequest);
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
        }
    } else {
        showLoginForm();
    }
}

async function checkAdminStatus() {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('is_admin')
            .eq('id', currentUser.id)
            .single();
        
        if (error && error.code !== 'PGRST116') {
            console.error('管理者ステータスの確認に失敗:', error);
            return;
        }
        
        isAdmin = data?.is_admin || false;
        
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

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });
        
        
        if (error) throw error;
        
        currentUser = data.user;
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
        }
    } catch (error) {
        alert('ログインに失敗しました: ' + error.message);
    }
}

async function handleSignup(e) {
    e.preventDefault();
    const name = document.getElementById('signupName').value;
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    
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
        showLoginForm();
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
        // 選択された各時間帯に対して申請を作成
        const insertData = checkedTimeSlots.map(timeSlot => ({
            user_id: currentUser.id,
            date: date,
            time_slot: timeSlot,
            note: note,
            status: 'pending'
        }));
        
        const { data, error } = await supabase
            .from('shifts')
            .insert(insertData);
        
        if (error) throw error;
        
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
        // 全ユーザーが自分のシフトのみを表示
        const { data, error } = await supabase
            .from('shifts')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('date', { ascending: true });
        
        if (error) throw error;
        
        displayShifts(data || []);
    } catch (error) {
        console.error('シフトの読み込みに失敗しました:', error);
    }
}


function displayShifts(shifts) {
    const shiftsList = document.getElementById('shiftsList');
    shiftsList.innerHTML = '';
    
    if (shifts.length === 0) {
        shiftsList.innerHTML = '<p>シフトがありません</p>';
        return;
    }
    
    shifts.forEach(shift => {
        const shiftItem = document.createElement('div');
        shiftItem.className = 'shift-item';
        shiftItem.innerHTML = `
            <div>
                <strong>${formatDate(shift.date)}</strong>
                <span>${getTimeSlotLabel(shift.time_slot)}</span>
                <span class="status-${shift.status || 'pending'}">${getStatusLabel(shift.status || 'pending')}</span>
                ${shift.note ? `<p class="shift-note">${shift.note}</p>` : ''}
            </div>
        `;
        shiftsList.appendChild(shiftItem);
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
        
        // ユーザー情報をマップに変換
        const usersMap = {};
        if (usersData) {
            usersData.forEach(user => {
                usersMap[user.id] = user.name;
            });
        }
        
        // シフトデータにユーザー名を追加
        const shiftsWithUsers = shiftsData.map(shift => ({
            ...shift,
            users: {
                name: usersMap[shift.user_id] || `ユーザー${shift.user_id.slice(-8)}`
            }
        }));
        
        displayAdminShifts(shiftsWithUsers);
    } catch (error) {
        console.error('管理者用シフトの読み込みに失敗しました:', error);
    }
}

function displayAdminShifts(shifts) {
    const adminShiftsList = document.getElementById('adminShiftsList');
    if (!adminShiftsList) {
        console.error('adminShiftsList要素が見つかりません');
        return;
    }
    adminShiftsList.innerHTML = '';
    
    if (shifts.length === 0) {
        adminShiftsList.innerHTML = '<p>シフトがありません</p>';
        return;
    }
    
    shifts.forEach(shift => {
        const shiftItem = document.createElement('div');
        shiftItem.className = 'admin-shift-item';
        
        const userName = shift.users?.name || 'ユーザー不明';
        
        shiftItem.innerHTML = `
            <div class="admin-item-info">
                <div class="admin-item-user">ユーザー: ${userName}</div>
                <div class="admin-item-details">
                    ${formatDate(shift.date)} - ${getTimeSlotLabel(shift.time_slot)}
                    <span class="status-${shift.status || 'pending'}">(${getStatusLabel(shift.status || 'pending')})</span>
                </div>
                ${shift.note ? `<div style="font-size: 12px; color: #666; margin-top: 5px;">${shift.note}</div>` : ''}
            </div>
            <div class="admin-actions">
                <select onchange="updateShiftStatus('${shift.id}', this.value)" class="status-select">
                    <option value="pending" ${(shift.status || 'pending') === 'pending' ? 'selected' : ''}>承認待ち</option>
                    <option value="approved" ${(shift.status || 'pending') === 'approved' ? 'selected' : ''}>承認</option>
                    <option value="rejected" ${(shift.status || 'pending') === 'rejected' ? 'selected' : ''}>却下</option>
                </select>
                <button class="delete-btn" onclick="deleteShift('${shift.id}')">削除</button>
            </div>
        `;
        adminShiftsList.appendChild(shiftItem);
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
            <span class="status-${shift.status}">${getStatusLabel(shift.status)}</span>
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
    } else if (tabName === 'manage' && isAdmin) {
        loadAdminData();
    }
}

function showLoginForm() {
    document.getElementById('loginSection').style.display = 'block';
    document.getElementById('signupSection').style.display = 'none';
    document.getElementById('mainContent').style.display = 'none';
}

function showSignupForm() {
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('signupSection').style.display = 'block';
    document.getElementById('mainContent').style.display = 'none';
}

function showMainContent() {
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('signupSection').style.display = 'none';
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
    showLoginForm();
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function getTimeSlotLabel(timeSlot) {
    const labels = {
        '13:00-14:00': '13:00-14:00',
        '14:00-15:00': '14:00-15:00',
        '15:00-16:00': '15:00-16:00',
        '16:00-17:00': '16:00-17:00',
        '17:00-18:00': '17:00-18:00'
    };
    return labels[timeSlot] || timeSlot;
}

function getStatusLabel(status) {
    const labels = {
        pending: '申請中',
        approved: '承認済み',
        rejected: '却下'
    };
    return labels[status] || status;
}

// 管理者専用の関数は削除（displayAdminShiftsはdisplayShifts内に統合済み）


async function deleteShift(shiftId) {
    if (!confirm('このシフトを削除しますか？')) {
        return;
    }
    
    try {
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



async function updateShiftStatus(shiftId, status) {
    try {
        const { error } = await supabase
            .from('shifts')
            .update({ status: status })
            .eq('id', shiftId);
        
        if (error) throw error;
        
        alert(`シフトを${getStatusLabel(status)}に変更しました`);
        loadAdminData();
    } catch (error) {
        alert('ステータス更新に失敗しました: ' + error.message);
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
        
        // 土日を除外
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            const option = document.createElement('option');
            const dateValue = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            option.value = dateValue;
            
            const weekDays = ['日', '月', '火', '水', '木', '金', '土'];
            option.textContent = `${monthNames[month]}${day}日 (${weekDays[dayOfWeek]})`;
            
            selectElement.appendChild(option);
        }
    }
}

window.logout = logout;
window.deleteShift = deleteShift;
window.updateShiftStatus = updateShiftStatus;
