# Phoenix Frontend

Phoenix OSのReactフロントエンドです。既存のJun AI Command Center公開版とは
分離して開発します。

## 開発コマンド

```bash
npm install
npm run dev
npm run test
npm run typecheck
npm run lint
npm run format:check
npm run build
```

## 現在の完了範囲

- React、TypeScript、Viteの初期構成
- PC・スマートフォン対応のPhoenix基盤画面
- ESLintとPrettierによる品質確認
- FastAPIの`GET /health`との型安全な接続
- 接続確認中・正常・失敗の状態表示
- ToDo一覧の読み込み・0件・通信失敗表示
- `GET /todos`による一覧取得と`POST /todos`による新規作成
- タイトル・説明・期限・優先度・任意カテゴリを入力できるフォーム
- カテゴリ名の保存・編集・文字付きバッジ表示・検索
- 作業日報で部門を選び、所属する稼働中設備を固有IDで保存・表示
- 各ToDoの期限と優先度をカードからすばやく変更
- 選択した複数ToDoの完了状態・期限・優先度・カテゴリ変更と一括複製
- APIキーや個人データを含まない安全な通信

## API接続

開発時は、既定で`http://127.0.0.1:8000`へ接続します。接続先を変更する
場合は`.env.example`を`.env`へコピーし、`VITE_API_BASE_URL`を設定します。

`VITE_`で始まる値はブラウザへ公開されるため、APIキーや秘密情報は
絶対に設定しません。
