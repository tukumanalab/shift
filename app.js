const GOOGLE_APPS_SCRIPT_URL = config.GOOGLE_APPS_SCRIPT_URL;
const GOOGLE_CLIENT_ID = config.GOOGLE_CLIENT_ID;

let currentUser = null;

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
    
    document.getElementById('userImage').src = profileData.picture;
    document.getElementById('userName').textContent = profileData.name;
    document.getElementById('userEmail').textContent = profileData.email;
    
    setupShiftForm();
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
    
    document.getElementById('userImage').src = '';
    document.getElementById('userName').textContent = '';
    document.getElementById('userEmail').textContent = '';
    document.getElementById('shiftForm').reset();
    
    console.log('ユーザーがログアウトしました');
}

window.onload = function () {
    document.getElementById('g_id_onload').setAttribute('data-client_id', GOOGLE_CLIENT_ID);
    
    google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse
    });
    
    google.accounts.id.renderButton(
        document.querySelector('.g_id_signin'),
        { theme: 'outline', size: 'large' }
    );
};