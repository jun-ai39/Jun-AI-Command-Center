# Jun AI Command Center

毎朝5分で、世界情勢・市場・投資・熊本と天草の情報を確認する個人用ダッシュボードです。

公開URL：<https://jun-ai39.github.io/Jun-AI-Command-Center/>

## 主な機能

- 世界情勢ニュース
- 株式市場・仮想通貨・為替・商品
- Bitcoin Fear & Greed Index
- ルールベースの朝ブリーフ（生成AI未使用）
- サンプルデータによる投資管理画面
- 熊本市の天気と週間予報
- 熊本・阿蘇・天草のツーリング候補
- 天草3地点の海況と気象庁潮位表へのリンク
- PC・スマートフォン対応

経済カレンダーとAIニュース専用画面は、今後の拡張項目です。

## データ更新

GitHub Actionsが毎朝6:17（日本時間）に次のファイルを更新し、GitHub Pagesへ自動公開します。

- `data/news.json`
- `data/market.json`
- `data/briefing.json`

更新処理に失敗した場合は、新しいデータをCommitせず、公開済みページを維持します。

## 主なデータ提供元

- BBC News / NHK RSS
- Yahoo Financeの公開エンドポイント（参考値・遅延あり）
- CoinGecko
- Alternative.me
- Open-Meteo
- 気象庁

各データは参考情報です。投資判断、走行判断、釣行判断には、最新の公式情報と現地状況も確認してください。

## セキュリティ

- APIキーや個人情報をリポジトリへ保存しません。
- 実際の投資資産は保存せず、架空のサンプルデータだけを表示します。
- 外部リンクはHTTPSに限定し、別タブを安全に開く設定を使用します。
- GitHub Actionsの権限はジョブごとに必要最小限へ分離しています。
- 使用するGitHub Actionsは正式リリースのCommit SHAへ固定しています。

## フォルダ構成

```text
Jun-AI-Command-Center/
├── index.html
├── css/
├── js/
├── data/
├── python/
└── .github/workflows/
```

## ローカル確認

Pythonが利用できる場合、リポジトリ直下で次を実行します。

```bash
python -m http.server 8000
```

ブラウザで <http://localhost:8000> を開きます。

## ライセンス

このリポジトリのコードは [MIT License](./LICENSE) で公開しています。外部データには各提供元の利用条件が適用されます。
