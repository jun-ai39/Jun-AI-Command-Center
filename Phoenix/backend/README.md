# Phoenix Backend

Phoenix OSとJun AI Command Centerを支えるFastAPIバックエンドです。
公開画面へAPIキーや個人データを渡さないため、秘密情報が必要な処理は
将来このバックエンド側へ集約します。

## 開発コマンド

```bash
uv sync --dev
uv run fastapi dev app/main.py
uv run pytest
uv run ruff check .
uv run black --check .
uv run alembic upgrade head
uv run python -m app.commands.create_admin --username jun
```

開発サーバーを起動すると、次のURLを利用できます。

- API: `http://127.0.0.1:8000/health`
- バージョン: `http://127.0.0.1:8000/version`
- ダッシュボード: `http://127.0.0.1:8000/dashboard`
- 設定: `http://127.0.0.1:8000/settings`
- ToDo: `http://127.0.0.1:8000/todos`
- 部門マスター: `http://127.0.0.1:8000/departments`
- メーカーマスター: `http://127.0.0.1:8000/manufacturers`
- 設備マスター: `http://127.0.0.1:8000/equipment`
- API仕様書: `http://127.0.0.1:8000/docs`

## 現在のAPI

| Method | Path                        | 役割                                       |
| ------ | --------------------------- | ------------------------------------------ |
| GET    | `/health`                   | APIの稼働状態と版を返す                    |
| GET    | `/version`                  | アプリとAPI仕様のバージョンを返す          |
| GET    | `/dashboard`                | 日付と各機能の準備状態を返す                |
| GET    | `/settings`                 | 秘密を含まない設定と連携状態を返す          |
| POST   | `/auth/login`               | ローカルユーザーとしてログインする          |
| POST   | `/auth/logout`              | 現在のログインセッションを終了する          |
| GET    | `/auth/me`                  | 現在のログインユーザーを確認する            |
| GET    | `/backups`                 | 管理者が検証済みバックアップ一覧を確認する  |
| POST   | `/backups`                 | 管理者が検証済みバックアップを作成する      |
| POST   | `/backups/{name}/restore`  | 次回起動時の安全な復元を予約する            |
| GET    | `/todos`                    | ToDo一覧をページ単位で返す                  |
| POST   | `/todos`                    | 新しいToDoを保存する                        |
| PATCH  | `/todos/{id}`               | ToDoの内容・状態・カテゴリを更新する        |
| DELETE | `/todos/{id}`               | ToDoを削除する                              |
| GET    | `/work-reports`             | 作業日報の一覧を取得する                    |
| POST   | `/work-reports`             | 作業日報を保存する                          |
| PATCH  | `/work-reports/{id}`        | 作業日報を更新する                          |
| GET    | `/departments`              | 部門マスター一覧を取得する                  |
| POST   | `/departments`              | 部門マスターを登録する                      |
| GET    | `/manufacturers`            | メーカーマスター一覧を取得する              |
| POST   | `/manufacturers`            | メーカーマスターを登録する                  |
| GET    | `/equipment`                | 設備を部門・メーカー等で絞り込んで取得する  |
| POST   | `/equipment`                | 固有IDを持つ設備を登録する                  |
| GET    | `/equipment/{equipment_id}` | 固有IDから設備詳細を取得する                |

## データベース

- 初期DB: `Phoenix/database/phoenix.sqlite3`
- ORM: SQLAlchemy 2
- マイグレーション: Alembic
- 接続先の変更: サーバー側の`PHOENIX_DATABASE_URL`
- 現在の主なテーブル:
  - `todos`: 期限・優先度・任意カテゴリを含むToDo項目
  - `work_reports`: 部門・固有設備IDと関連付けられる保存済み作業日報
  - `departments`: 管理可能な部門マスター
  - `manufacturers`: 複数部門から再利用できるメーカーマスター
  - `equipment`: 部門とメーカーに関連付けた固有設備
  - `users`: Argon2パスワードハッシュと権限を持つローカルユーザー
  - `user_sessions`: 失効可能なログインセッションのハッシュ

設備写真は画像本体をDBへ保存せず、将来の内部保存先を示す任意の
`photo_path`だけを設備マスターに保持します。

新規・更新する作業日報は、稼働中の部門と、その部門に所属する稼働中設備を
指定します。設備連携前に保存された日報は削除せず、設備未設定の履歴として
引き続き取得できます。

初回起動前やテーブル定義の更新後は、次を実行します。

```bash
uv run alembic upgrade head
```

初回だけ、管理者名を指定して次のコマンドを実行します。パスワードは
コマンドへ直接書かず、表示されない入力欄へ2回入力します。

```bash
uv run python -m app.commands.create_admin --username jun
```

SQLiteファイルはGit管理から除外され、マイグレーション履歴だけを保存します。

復元は稼働中のDBを直接上書きしません。管理者が復元を予約すると現状の安全コピーを
作成し、次回API起動時のDB接続前に選択した検証済みファイルへ切り替えます。
復元後は保存済みセッションを削除するため、全ユーザーが再ログインします。

現在のセッションCookieは、同じPCの`localhost`でHTTP利用する前提です。
工場LANやクラウドへ移す場合は、HTTPS化とCookieの`Secure`設定を先に行います。

## セキュリティ

- APIキーや認証情報をソースコードへ書きません。
- 実際の投資情報や工場データを公開リポジトリへ保存しません。
- `.env`はGit管理から除外します。
