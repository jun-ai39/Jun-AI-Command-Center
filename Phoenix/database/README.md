# Phoenix Database

Phoenix OSのローカルデータを保存する領域です。初期構成では無料で利用できる
SQLiteを使い、将来は`PHOENIX_DATABASE_URL`を変更してPostgreSQLへ移行します。

- 実際の`.db`、`.sqlite`、`.sqlite3`ファイルはGitへ保存しません。
- テーブル変更は`backend/alembic/versions/`の履歴として管理します。
- APIキー、認証情報、実際の投資情報を公開リポジトリへ保存しません。
