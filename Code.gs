// =====================
// 設定（自分の値に書き換えてください）
// =====================
const CONSUMER_KEY    = 'YOUR_CONSUMER_KEY';
const CONSUMER_SECRET = 'YOUR_CONSUMER_SECRET';

// Zaim カテゴリID・ジャンルID（必要に応じて変更）
// カテゴリ一覧は setup.md を参照
const CATEGORY_ID = 16;  // 食費
const GENRE_ID    = 167; // その他

// 支出元口座ID（Zaim上のANAPayの口座ID）
// 変更方法は setup.md を参照
const FROM_ACCOUNT_ID = 21397232;

// 処理済みメールに付与するGmailラベル名
const PROCESSED_LABEL = 'ANA_Pay_Processed';


// =====================
// メイン処理
// =====================
function processAnaPayEmails() {
  const label = GmailApp.getUserLabelByName(PROCESSED_LABEL)
    ?? GmailApp.createLabel(PROCESSED_LABEL);

  const threads = GmailApp.search(
    `from:payinfo@121.ana.co.jp subject:ANA Pay -label:${PROCESSED_LABEL}`
  );

  Logger.log('対象スレッド数: ' + threads.length);

  threads.forEach(thread => {
    thread.getMessages().forEach(message => {
      const body = message.getPlainBody() + '\n' + message.getRawContent();
      const parsed = parseAnaPayEmail(body);
      if (parsed) {
        registerToZaim(parsed);
        Logger.log(`登録完了: ${parsed.date} ${parsed.amount}円 ${parsed.place}`);
      } else {
        Logger.log('パース失敗: ' + (message.getPlainBody() || '').substring(0, 100));
      }
    });
    thread.addLabel(label);
  });
}


// =====================
// メール解析
// =====================
function parseAnaPayEmail(body) {
  try {
    if (!body) return null;

    const dateMatch   = body.match(/ご利用日時[：:]\s*(\d{4}-\d{2}-\d{2})/);
    const amountMatch = body.match(/ご利用金額[：:]\s*(\d+)円/);
    const placeMatch  = body.match(/ご利用店舗[：:]\s*(.+)/);

    if (!dateMatch || !amountMatch || !placeMatch) {
      Logger.log('マッチ失敗 date:' + dateMatch + ' amount:' + amountMatch + ' place:' + placeMatch);
      return null;
    }

    return {
      date:   dateMatch[1],
      amount: parseInt(amountMatch[1]),
      place:  placeMatch[1].trim(),
    };
  } catch (e) {
    Logger.log('パースエラー: ' + e.message);
    return null;
  }
}


// =====================
// Zaim への登録
// =====================
function registerToZaim({ amount, place, date }) {
  const props  = PropertiesService.getScriptProperties();
  const token  = props.getProperty('ZAIM_ACCESS_TOKEN');
  const secret = props.getProperty('ZAIM_ACCESS_SECRET');

  const url = 'https://api.zaim.net/v2/home/money/payment';
  const params = {
    mapping:         1,
    category_id:     CATEGORY_ID,
    genre_id:        GENRE_ID,
    amount:          amount,
    date:            date,
    place:           place,
    comment:         'ANA Pay（自動入力）',
    from_account_id: FROM_ACCOUNT_ID,
  };

  const nonce     = Utilities.getUuid().replace(/-/g, '');
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const oauthParams = {
    oauth_consumer_key:     CONSUMER_KEY,
    oauth_nonce:            nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp:        timestamp,
    oauth_token:            token,
    oauth_version:          '1.0',
  };

  const allParams  = { ...params, ...oauthParams };
  const baseString = 'POST&' +
    encodeURIComponent(url) + '&' +
    encodeURIComponent(
      Object.keys(allParams).sort()
        .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(allParams[k])}`)
        .join('&')
    );

  const signingKey = encodeURIComponent(CONSUMER_SECRET) + '&' + encodeURIComponent(secret);
  const signature  = Utilities.base64Encode(
    Utilities.computeHmacSignature(Utilities.MacAlgorithm.HMAC_SHA_1, baseString, signingKey)
  );
  oauthParams['oauth_signature'] = signature;

  const header = 'OAuth ' + Object.entries(oauthParams)
    .map(([k, v]) => `${k}="${encodeURIComponent(v)}"`)
    .join(', ');

  const payload = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');

  const res = UrlFetchApp.fetch(url, {
    method:           'POST',
    headers:          { Authorization: header, 'Content-Type': 'application/x-www-form-urlencoded' },
    payload:          payload,
    muteHttpExceptions: true,
  });

  Logger.log('Zaim応答: ' + res.getContentText());
}


// =====================
// 初回セットアップ用（一度だけ実行）
// =====================

// Step1: リクエストトークン取得 → 認証URLをログに出力
function getAccessToken_Step1() {
  const nonce     = Utilities.getUuid().replace(/-/g, '');
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const callback  = 'https://script.google.com/';

  const oauthParams = {
    oauth_callback:         callback,
    oauth_consumer_key:     CONSUMER_KEY,
    oauth_nonce:            nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp:        timestamp,
    oauth_version:          '1.0',
  };

  const baseString = 'GET&' +
    encodeURIComponent('https://api.zaim.net/v2/auth/request') + '&' +
    encodeURIComponent(
      Object.keys(oauthParams).sort()
        .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(oauthParams[k])}`)
        .join('&')
    );

  const signingKey = encodeURIComponent(CONSUMER_SECRET) + '&';
  const signature  = Utilities.base64Encode(
    Utilities.computeHmacSignature(Utilities.MacAlgorithm.HMAC_SHA_1, baseString, signingKey)
  );
  oauthParams['oauth_signature'] = signature;

  const header = 'OAuth ' + Object.entries(oauthParams)
    .map(([k, v]) => `${k}="${encodeURIComponent(v)}"`)
    .join(', ');

  const res = UrlFetchApp.fetch('https://api.zaim.net/v2/auth/request', {
    headers:            { Authorization: header },
    muteHttpExceptions: true,
  });

  const params = Object.fromEntries(
    res.getContentText().split('&').map(p => p.split('='))
  );

  PropertiesService.getScriptProperties().setProperties({
    REQUEST_TOKEN:        params['oauth_token'],
    REQUEST_TOKEN_SECRET: params['oauth_token_secret'],
  });

  Logger.log('★ このURLをブラウザで開いてZaimにログインしてください:');
  Logger.log(`https://auth.zaim.net/users/auth?oauth_token=${params['oauth_token']}`);
}

// Step2: oauth_verifier を引数に渡してアクセストークンを取得・保存
function getAccessToken_Step2() {
  const verifier = 'YOUR_OAUTH_VERIFIER'; // ← 認証後のURLから取得した verifier を貼る

  const props              = PropertiesService.getScriptProperties();
  const requestToken       = props.getProperty('REQUEST_TOKEN');
  const requestTokenSecret = props.getProperty('REQUEST_TOKEN_SECRET');

  const nonce     = Utilities.getUuid().replace(/-/g, '');
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const oauthParams = {
    oauth_consumer_key:     CONSUMER_KEY,
    oauth_nonce:            nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp:        timestamp,
    oauth_token:            requestToken,
    oauth_verifier:         verifier,
    oauth_version:          '1.0',
  };

  const baseString = 'GET&' +
    encodeURIComponent('https://api.zaim.net/v2/auth/access') + '&' +
    encodeURIComponent(
      Object.keys(oauthParams).sort()
        .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(oauthParams[k])}`)
        .join('&')
    );

  const signingKey = encodeURIComponent(CONSUMER_SECRET) + '&' + encodeURIComponent(requestTokenSecret);
  const signature  = Utilities.base64Encode(
    Utilities.computeHmacSignature(Utilities.MacAlgorithm.HMAC_SHA_1, baseString, signingKey)
  );
  oauthParams['oauth_signature'] = signature;

  const header = 'OAuth ' + Object.entries(oauthParams)
    .map(([k, v]) => `${k}="${encodeURIComponent(v)}"`)
    .join(', ');

  const res = UrlFetchApp.fetch('https://api.zaim.net/v2/auth/access', {
    headers:            { Authorization: header },
    muteHttpExceptions: true,
  });

  const result = Object.fromEntries(
    res.getContentText().split('&').map(p => p.split('='))
  );

  props.setProperties({
    ZAIM_ACCESS_TOKEN:  result['oauth_token'],
    ZAIM_ACCESS_SECRET: result['oauth_token_secret'],
  });

  Logger.log('✅ アクセストークン保存完了！');
}

// Zaim口座一覧を取得（FROM_ACCOUNT_ID 確認用）
function getAccounts() {
  const props  = PropertiesService.getScriptProperties();
  const token  = props.getProperty('ZAIM_ACCESS_TOKEN');
  const secret = props.getProperty('ZAIM_ACCESS_SECRET');

  const url = 'https://api.zaim.net/v2/home/account';

  const nonce     = Utilities.getUuid().replace(/-/g, '');
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const oauthParams = {
    oauth_consumer_key:     CONSUMER_KEY,
    oauth_nonce:            nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp:        timestamp,
    oauth_token:            token,
    oauth_version:          '1.0',
  };

  const baseString = 'GET&' +
    encodeURIComponent(url) + '&' +
    encodeURIComponent(
      Object.keys(oauthParams).sort()
        .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(oauthParams[k])}`)
        .join('&')
    );

  const signingKey = encodeURIComponent(CONSUMER_SECRET) + '&' + encodeURIComponent(secret);
  const signature  = Utilities.base64Encode(
    Utilities.computeHmacSignature(Utilities.MacAlgorithm.HMAC_SHA_1, baseString, signingKey)
  );
  oauthParams['oauth_signature'] = signature;

  const header = 'OAuth ' + Object.entries(oauthParams)
    .map(([k, v]) => `${k}="${encodeURIComponent(v)}"`)
    .join(', ');

  const res = UrlFetchApp.fetch(url, {
    headers:            { Authorization: header },
    muteHttpExceptions: true,
  });

  Logger.log(res.getContentText());
}
