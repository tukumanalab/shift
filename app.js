const GOOGLE_APPS_SCRIPT_URL = config.GOOGLE_APPS_SCRIPT_URL;
const GOOGLE_CLIENT_ID = config.GOOGLE_CLIENT_ID;
const AUTHORIZED_EMAILS = config.AUTHORIZED_EMAILS.split(',').map(email => email.trim());

let currentUser = null;

function handleCredentialResponse(response) {
    const responsePayload = decodeJwtResponse(response.credential);
    
    console.log("ID: " + responsePayload.sub);
    console.log('Full Name: ' + responsePayload.name);
    console.log('Given Name: ' + responsePayload.given_name);
    console.log('Family Name: ' + responsePayload.family_name);
    console.log("Image URL: " + responsePayload.picture);
    console.log("Email: " + responsePayload.email);

    // Check if email is authorized
    if (!AUTHORIZED_EMAILS.includes(responsePayload.email)) {
        alert('アクセスが拒否されました。\nこのアプリケーションは許可されたユーザーのみ利用可能です。');
        signOut();
        return;
    }

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
    
    document.getElementById('loginButton').classList.add('hidden');
    document.getElementById('profileInfo').classList.remove('hidden');
    document.getElementById('loginPrompt').classList.add('hidden');
    document.getElementById('appContent').classList.remove('hidden');
    
    document.getElementById('userImage').src = profileData.picture;
    document.getElementById('userName').textContent = profileData.name;
    document.getElementById('userEmail').textContent = profileData.email;
    
    loadShiftList();
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
        });
    });
}

function loadShiftList() {
    // TODO: Implement shift list loading from Google Sheets
    console.log('Loading shift list...');
}

function saveCapacitySettings() {
    const capacities = {
        morning: document.getElementById('morning-capacity').value,
        am: document.getElementById('am-capacity').value,
        pm: document.getElementById('pm-capacity').value,
        evening: document.getElementById('evening-capacity').value,
        night: document.getElementById('night-capacity').value,
        late: document.getElementById('late-capacity').value,
        fullday: document.getElementById('fullday-capacity').value
    };
    
    // TODO: Save capacity settings to Google Sheets
    console.log('Saving capacity settings:', capacities);
    alert('人数設定を保存しました！');
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