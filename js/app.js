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
        updateUserInfo();
        loadShifts();
        loadRequests();
        populateDateDropdown();
        if (isAdmin) {
            loadAdminData();
        }
    } else {
        showLoginForm();
    }
}

async function checkAdminStatus() {
    try {
        const { data, error } = await supabase
            .from('user_profiles')
            .select('is_admin')
            .eq('user_id', currentUser.id)
            .single();
        
        if (error && error.code !== 'PGRST116') {
            console.error('管理者ステータスの確認に失敗:', error);
            return;
        }
        
        isAdmin = data?.is_admin || false;
        
        const adminTab = document.getElementById('adminTab');
        if (isAdmin) {
            adminTab.style.display = 'block';
        } else {
            adminTab.style.display = 'none';
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
        updateUserInfo();
        loadShifts();
        loadRequests();
        if (isAdmin) {
            loadAdminData();
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
            .from('shift_requests')
            .insert(insertData);
        
        if (error) throw error;
        
        alert(`${checkedTimeSlots.length}件のシフト希望を申請しました`);
        document.getElementById('shiftRequestForm').reset();
        loadRequests();
    } catch (error) {
        alert('申請に失敗しました: ' + error.message);
    }
}

async function loadShifts() {
    try {
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

async function loadRequests() {
    try {
        const { data, error } = await supabase
            .from('shift_requests')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('date', { ascending: false });
        
        if (error) throw error;
        
        displayRequests(data || []);
    } catch (error) {
        console.error('申請の読み込みに失敗しました:', error);
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
            </div>
        `;
        shiftsList.appendChild(shiftItem);
    });
}

function displayRequests(requests) {
    const requestsContent = document.getElementById('requestsContent');
    requestsContent.innerHTML = '';
    
    if (requests.length === 0) {
        requestsContent.innerHTML = '<p>申請がありません</p>';
        return;
    }
    
    requests.forEach(request => {
        const requestItem = document.createElement('div');
        requestItem.className = 'request-item';
        requestItem.innerHTML = `
            <div>
                <strong>${formatDate(request.date)}</strong>
                <span>${getTimeSlotLabel(request.time_slot)}</span>
                ${request.note ? `<p>${request.note}</p>` : ''}
            </div>
            <span class="status-${request.status}">${getStatusLabel(request.status)}</span>
        `;
        requestsContent.appendChild(requestItem);
    });
}





function switchTab(tabName) {
    document.querySelectorAll('.tab-button').forEach(button => {
        button.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    
    document.querySelectorAll('.tab-content').forEach(content => {
        content.style.display = 'none';
    });
    document.getElementById(`${tabName}Tab`).style.display = 'block';
    
    if (tabName === 'admin' && isAdmin) {
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

function updateUserInfo() {
    const userInfo = document.getElementById('userInfo');
    if (currentUser) {
        const adminBadge = isAdmin ? '<span class="admin-badge">管理者</span>' : '';
        userInfo.innerHTML = `
            ${currentUser.user_metadata?.name || currentUser.email}
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

async function loadAdminData() {
    await loadAllShifts();
    await loadAllRequests();
}

async function loadAllShifts() {
    try {
        const { data, error } = await supabase
            .from('shifts')
            .select(`
                *,
                user_profiles!inner(user_id)
            `)
            .order('date', { ascending: false });
        
        if (error) throw error;
        
        displayAdminShifts(data || []);
    } catch (error) {
        console.error('全シフトの読み込みに失敗しました:', error);
    }
}

async function loadAllRequests() {
    try {
        const { data, error } = await supabase
            .from('shift_requests')
            .select(`
                *,
                user_profiles!inner(user_id)
            `)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        displayAdminRequests(data || []);
    } catch (error) {
        console.error('全申請の読み込みに失敗しました:', error);
    }
}

function displayAdminShifts(shifts) {
    const adminShiftsList = document.getElementById('adminShiftsList');
    adminShiftsList.innerHTML = '';
    
    if (shifts.length === 0) {
        adminShiftsList.innerHTML = '<p>シフトがありません</p>';
        return;
    }
    
    shifts.forEach(shift => {
        const shiftItem = document.createElement('div');
        shiftItem.className = 'admin-shift-item';
        shiftItem.innerHTML = `
            <div class="admin-item-info">
                <div class="admin-item-user">ユーザーID: ${shift.user_id}</div>
                <div class="admin-item-details">
                    ${formatDate(shift.date)} - ${getTimeSlotLabel(shift.time_slot)}
                </div>
            </div>
            <div class="admin-actions">
                <button class="delete-btn" onclick="deleteShift('${shift.id}')">削除</button>
            </div>
        `;
        adminShiftsList.appendChild(shiftItem);
    });
}

function displayAdminRequests(requests) {
    const adminRequestsList = document.getElementById('adminRequestsList');
    adminRequestsList.innerHTML = '';
    
    if (requests.length === 0) {
        adminRequestsList.innerHTML = '<p>申請がありません</p>';
        return;
    }
    
    requests.forEach(request => {
        const requestItem = document.createElement('div');
        requestItem.className = 'admin-request-item';
        requestItem.innerHTML = `
            <div class="admin-item-info">
                <div class="admin-item-user">ユーザーID: ${request.user_id}</div>
                <div class="admin-item-details">
                    ${formatDate(request.date)} - ${getTimeSlotLabel(request.time_slot)}
                    <span class="status-${request.status}">(${getStatusLabel(request.status)})</span>
                </div>
                ${request.note ? `<div style="font-size: 12px; color: #666; margin-top: 5px;">${request.note}</div>` : ''}
            </div>
            <div class="admin-actions">
                ${request.status === 'pending' ? `
                    <button class="approve-btn" onclick="updateRequestStatus('${request.id}', 'approved')">承認</button>
                    <button class="reject-btn" onclick="updateRequestStatus('${request.id}', 'rejected')">却下</button>
                ` : ''}
            </div>
        `;
        adminRequestsList.appendChild(requestItem);
    });
}

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

async function updateRequestStatus(requestId, status) {
    try {
        const { error } = await supabase
            .from('shift_requests')
            .update({ status: status })
            .eq('id', requestId);
        
        if (error) throw error;
        
        alert(`申請を${status === 'approved' ? '承認' : '却下'}しました`);
        loadAdminData();
        
        if (status === 'approved') {
            await createShiftFromRequest(requestId);
        }
    } catch (error) {
        alert('ステータス更新に失敗しました: ' + error.message);
    }
}

async function createShiftFromRequest(requestId) {
    try {
        const { data: request, error: fetchError } = await supabase
            .from('shift_requests')
            .select('*')
            .eq('id', requestId)
            .single();
        
        if (fetchError) throw fetchError;
        
        const { error: insertError } = await supabase
            .from('shifts')
            .insert([{
                user_id: request.user_id,
                date: request.date,
                time_slot: request.time_slot
            }]);
        
        if (insertError) throw insertError;
        
    } catch (error) {
        console.error('シフト作成に失敗しました:', error);
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
window.updateRequestStatus = updateRequestStatus;