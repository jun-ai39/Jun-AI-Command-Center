# Phoenix OS 開発領域

Phoenix OSは、Jun AI Command Centerを商用品質へ発展させる次世代版です。
新しいフルスタック基盤はこのフォルダ内で開発し、リポジトリ直下にある
既存の静的ダッシュボードは、安定した公開版として維持します。

## Version 1の技術構成

- フロントエンド: React、TypeScript、Vite、Tailwind CSS、shadcn/ui
- バックエンド: FastAPI、型ヒント付きPython
- データベース: SQLite、SQLAlchemy、Alembic
- API: REST
- 品質管理: ESLint、Prettier、Ruff、Black、自動テスト
- 配布・運用: Git、GitHub Actions、実行環境を用意した後のDocker

## フォルダの役割

```text
Phoenix/
├── frontend/      # ブラウザ画面
├── backend/       # FastAPIアプリとREST API
├── database/      # ローカルDBとデータベース設計資料
├── agents/        # 独立したAIエージェント
├── workflows/     # 処理手順とエージェント連携
├── integrations/  # 外部サービスとの接続処理
├── docs/          # 設計・運用ドキュメント
├── tests/         # アプリ全体を対象にしたテスト
└── docker/        # コンテナ設定
```

## セキュリティ境界

- APIキー、認証情報、実際の投資情報、工場データを公開リポジトリへ保存しません。
- 移行中も既存のGitHub Pages版を動作させます。
- ブラウザへ配信されるファイルは、すべて公開情報として扱います。
- 有料クラウドサービスは、明確な事前承認を得てから開始します。

## 最初の実装目標（完了）

Reactの状態カードをFastAPIの`GET /health`へ接続し、通信中・接続成功・
接続失敗を画面へ表示できる最小経路を構築しました。フロントエンドとAPIの
自動テストを維持しながら、今後の機能をこの基盤へ追加します。

## Windows PCでのローカル試行

Phoenixは現在、ジュンのWindows PC 1台だけで使う前提です。外部公開や
工場LANへの待ち受けは行わず、APIと画面を`127.0.0.1`だけで起動します。

初回だけ、`Phoenix/setup_phoenix.cmd`をダブルクリックします。管理者名を入力後、
パスワードは画面に表示されない入力欄へ2回入力します。パスワードをファイルや
コマンド履歴へ保存しません。

通常の利用は次の2ファイルだけです。

1. `start_phoenix.cmd`をダブルクリックするとDB更新と画面ビルドを確認し、ブラウザを開く
2. `stop_phoenix.cmd`をダブルクリックすると、Phoenixが起動した2プロセスだけを停止する

起動中は最初の黒い画面を閉じずに使います。停止は黒い画面を直接閉じるのではなく、
`stop_phoenix.cmd`を使用します。起動ログとPID情報はGit管理外の`Phoenix/.runtime/`
へ保存されます。

バックアップから復元を予約した場合も、一度`stop_phoenix.cmd`で停止してから
`start_phoenix.cmd`で起動します。DB接続前に復元し、以前のログイン状態を失効させます。

必要な事前ツールはPython 3.12、uv、Node.js／npmです。初回セットアップ時だけ、
固定された依存関係の取得にインターネット接続を使用します。
