# セットアップ手順

## 事前確認

- ANA Pay アプリの **メール通知設定がオン**になっているか確認してください
- Gmail 以外（Outlook など）をメインで使っている場合は、`payinfo@121.ana.co.jp` からのメールを Gmail に転送する設定を先に行ってください

---

## Step 1: Zaim API アプリの登録

1. [dev.zaim.net](https://dev.zaim.net/users/login) にアクセスしてログイン

   > **ソーシャルログイン（Google など）でZaimを使っている場合**
   > dev.zaim.net へのログインにはメールアドレス＋パスワードが必要です。
   > zaim.net の設定画面からパスワードを設定するか、ログイン画面の「Forget password?」からパスワードをリセットしてください。

2. 「**新しいアプリケーションを追加**」をクリック

3. 以下を入力して登録

   | 項目 | 入力値 |
   |------|--------|
   | 名称 | ANAPay自動登録（任意） |
   | サービス種 | **ブラウザアプリ** |
   | 概要 | 任意（必須の場合は適当でOK） |
   | サービスのURL | `https://script.google.com/` |
   | アクセスレベル | **3つすべてチェック** |

4. 登録後に表示される **Consumer ID（Key）** と **Consumer Secret** をメモしておく

---

## Step 2: GAS プロジェクトの作成

1. [script.google.com](https://script.google.com) を開く
2. 「**新しいプロジェクト**」をクリック
3. プロジェクト名を任意で設定（例：`ANAPay2Zaim`）
4. デフォルトで表示されている `function myFunction() {}` を**すべて削除**
5. このリポジトリの `Code.gs` の内容を貼り付け
6. 上部の `CONSUMER_KEY` / `CONSUMER_SECRET` を Step 1 で取得した値に書き換えて保存（`Ctrl+S`）

---

## Step 3: アクセストークンの取得（初回のみ）

### 3-1. リクエストトークンの取得

GAS エディタ上部の関数選択から `getAccessToken_Step1` を選択して「**実行**」をクリック。

ログに以下のような URL が表示されます：

```
★ このURLをブラウザで開いてください: https://auth.zaim.net/users/auth?oauth_token=XXXXX
```

この URL をブラウザで開き、Zaim にログインして「**許可する**」をクリック。

### 3-2. アクセストークンの取得

許可後のリダイレクト先 URL から `oauth_verifier` の値をコピーします：

```
https://script.google.com/home?oauth_token=XXXXX&oauth_verifier=★ここをコピー★
```

> リダイレクトされない場合は、ブラウザのアドレスバーに表示されている URL を確認してください。

`Code.gs` の `getAccessToken_Step2()` 内の以下の行に貼り付け：

```javascript
const verifier = 'コピーしたverifierをここに貼る';
```

`getAccessToken_Step2` を実行して、ログに `✅ アクセストークン保存完了！` と表示されれば成功です。

---

## Step 4: 口座 ID の確認

`getAccounts()` を実行するとログに Zaim の口座一覧が JSON 形式で表示されます。

`"name":"ANAPAY"` の `"id"` の値を確認して、`Code.gs` の `FROM_ACCOUNT_ID` を更新してください：

```javascript
const FROM_ACCOUNT_ID = 12345678; // ← 自分のANAPay口座IDに変更
```

---

## Step 5: 動作確認

`processAnaPayEmails()` を実行して、Zaim に支出が登録されることを確認してください。

ログに `登録完了: YYYY-MM-DD XXX円 店舗名` と表示されれば成功です。

> **メールが見つからない場合**
> Gmail の検索バーで `from:payinfo@121.ana.co.jp` と検索してメールが届いているか確認してください。

---

## Step 6: トリガーの設定

1. GAS エディタ左側の **時計アイコン（トリガー）** をクリック
2. 右下の「**トリガーを追加**」をクリック
3. 以下のように設定して「保存」

   | 項目 | 設定値 |
   |------|--------|
   | 実行する関数 | `processAnaPayEmails` |
   | イベントのソース | 時間主導型 |
   | タイプ | 時間ベースのタイマー |
   | 間隔 | **1時間おき** |

---

これでセットアップ完了です 🎉

ANA Pay で支払いをすると、最大1時間以内に Zaim へ自動登録されます。