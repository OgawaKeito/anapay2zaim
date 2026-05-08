# Security Policy

## 秘密情報の取り扱い

このプロジェクトでは以下の秘密情報を扱います。**絶対にコードやリポジトリにコミットしないでください。**

- Zaim API Consumer Key / Consumer Secret
- Zaim Access Token / Access Secret

これらは Google Apps Script の「スクリプトプロパティ」（PropertiesService）に保存し、コードからは参照のみ行う設計になっています。

## 脆弱性を発見した場合

公開 Issue ではなく、GitHub の [Private vulnerability reporting](https://github.com/OgawaKeito/anapay2zaim/security/advisories/new) または直接 Issue のコメントでご連絡ください。

## サポートするバージョン

現在メンテナンスされているバージョンは `main` ブランチのみです。
