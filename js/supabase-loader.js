// 環境に応じて適切な設定ファイルを読み込む
(function() {
    const script = document.createElement('script');
    
    // localhostで実行されているかチェック
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        script.src = 'js/supabase-config-local.js';
        console.log('ローカル環境の設定を使用');
    } else {
        script.src = 'js/supabase-config.js';
        console.log('本番環境の設定を使用');
    }
    
    document.head.appendChild(script);
})();