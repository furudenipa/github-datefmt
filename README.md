# github-datefmt

GitHub の日付表示を読みやすい数値表記にそろえる Chrome 拡張機能。設定不要で、確認できた GitHub の日時表示を変換する。

## 背景と目的

GitHub Projects の `Nov 10, 2026` のような英語の月名や、GitHub の各画面にある `2 weeks ago` のような相対日時を、具体的な日付として読みたい。GitHub 上で動くコードや更新を自分で管理したいことも、自作する主な理由である。

## 機能要件

- `https://github.com/` の各ページを対象に、相対日時を元の日時に基づく絶対表示にする。
- 英語の月名を含む日付表示を `YYYY-MM-DD` にする。特に GitHub Projects の日付フィールドを対象に含める。
- 日付部分はゼロ埋めした `YYYY-MM-DD` で統一する。時刻を含む日時はブラウザのローカルタイムゾーンで `YYYY-MM-DD HH:mm` と表示する。秒は表示しない。
- 設定なしで動作することを目指す。オン・オフは Chrome の拡張機能管理画面での切り替えを基本とし、独自の設定画面は設けない方針。
- 表示変更にとどめ、GitHub のデータや日付の編集操作を変更しない。元の日付を確実に特定できない場合は推測して書き換えず、そのまま残す。

対象は GitHub.com 全体を目指すが、初めから全画面の網羅は保証しない。まず Projects の日付フィールドと、Issue、Pull Request、コミットなどで確認できた日時表示を調査・対応し、漏れを見つけたら対象と再現例を追加して段階的に広げる。現在は `relative-time[datetime]` を使う表示と、確認できた Projects ボードの日付トークン、表形式のセルおよび Issue のフィールド表示に対応している。コミット履歴の日付見出しにも対応する。すべての画面への対応は保証しない。GitHub Enterprise Server など別のホストは現時点では対象外とする。

## 実装方針

- Manifest V3 と純粋な JavaScript を基本とし、可能な限り Content Script だけで完結させる。外部 API への通信は行わない。
- 実行対象を `https://github.com/*` に限定し、`cookies`、`tabs`、`storage` など不要な追加権限を要求しない。ただし権限ゼロではない。Content Script の対象サイトへのアクセスは必要で、Chrome がサイトデータの読み取り・変更に関する警告を表示する場合がある。非公開リポジトリを含め、表示中のページを扱えることを前提に設計する。
- 元の日時を持つ属性や日時専用要素を優先する。GitHub の [`relative-time` 要素](https://github.com/github/relative-time-element) は `datetime` を持ち、絶対日時表示もサポートするため有力な候補。元の `datetime` を読み取り、表示用のテキスト（Shadow DOM 内を含む）を書き換える。子要素を持つ場合や値が不正な場合は変更しない。
- Projects の日付フィールドは、相対日時と同じ DOM や元データを持つとは限らない。実際の構造を調べ、対象を限定して処理する。ページ全体の文章を無差別に日付として置換しない。
- ページ遷移や動的追加・更新後も対応できるようにする。監視対象と処理量を絞り、繰り返し処理によるループや GitHub 側の再描画との競合を避ける。
- DOM を変更する際はリンク、操作、アクセシビリティ情報を損なわないようにする。HTML の組み立てや外部コードの読み込みを避け、依存関係は必要性を検討してから導入する。

## 日付とタイムゾーン

日付だけの値と、時刻を含む瞬間を区別する。

- Projects の期限のような**暦日**は、元の年月日をそのまま `YYYY-MM-DD` として扱い、タイムゾーン変換で前日・翌日にずらさない。
- UTC オフセットなどを含む**日時**は、ブラウザのローカルタイムゾーンで表示することを初期方針とする。日付の境界や夏時間を考慮し、日時の元データと表示結果を検証する。
- JavaScript の `Date` と `Intl.DateTimeFormat` で十分対応できるか、実装とテストを通じて判断する。日付のみの ISO 文字列は `Date` で UTC として解釈されるため、ローカル表示への安易な変換を避ける。`toISOString()` も UTC を返すため、ローカル日付の生成にそのまま使わない。英語の日付文字列の暗黙的なパースには依存せず、形式と妥当性を明示的に確認する。
- 日付ライブラリは現時点では導入しない方針。標準 API で正確かつ簡潔に扱えない要件が見つかった場合に、必要性、依存や保守上のコストを再評価する。

## 検証の観点

実装時は、実際の GitHub 画面と再現用のデータで少なくとも次を確認する。

- Projects の日付フィールド、Issue・Pull Request、コミットなど、対応した画面ごとの変換と未対応箇所。
- 初回表示、画面内の遷移、追加・更新された要素、および繰り返し処理時の安定性。
- 年末年始、うるう日、UTC とローカルで日付が異なる瞬間、夏時間の境界、日付のみの値。
- 日付を特定できない値や不正な値は変更しないこと。リンクや編集操作、支援技術向けの情報が壊れないこと。
- 権限、ネットワーク通信、動作対象が上記の方針に合うこと。

## 制約

- Projects の表は GitHub がページ内に置く列定義の型と ID に基づいて判定する。列定義が取得できない場合や構造が変更された場合は、対象セルを変換せずに残す。
- GitHub の画面構造の変更や未確認の表示形式には対応できない場合がある。年のない日付、曖昧な日時、不正な値は推測しない。
- Chrome の実画面では一部の表示と画面遷移を確認済み。編集・保存操作など未確認の項目は確認メモに記録する。
- 秒とタイムゾーン名は表示しない。元の日時や GitHub のツールチップは保持する。

実画面の確認履歴と未確認箇所は [Chrome 実画面の確認メモ](docs/manual-checks.md) を参照。

## 参考

- [元の TODO](https://github.com/furudenipa-todo/todo/issues/119)
- [GitHub の relative-time-element](https://github.com/github/relative-time-element)
- [Chrome 拡張機能の権限宣言](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions)
- [MDN: JavaScript Date](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date)
- [MDN: Date.parse()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/parse)

## 開発

Node.js 22.13 以降を使用する。拡張機能の実行時依存はなく、開発時には ESLint を使用する。初回は `npm ci --ignore-scripts` を実行する。

```sh
npm run check
```

このコマンドは ESLint、JavaScript の構文、manifest の JSON、および対象サイト・追加権限などの基本制約を検査する。GitHub Actions でも push と Pull Request で同じ検査を実行する。Dependabot は Actions と npm の更新を毎日確認する。拡張機能のコードでは、ESLint が `fetch`、`XMLHttpRequest`、`WebSocket`、`sendBeacon` などの一般的な通信 API と動的コード評価の使用を禁止する。ただし、別名や動的なプロパティ参照、DOM を通じた通信などをすべて検出できるわけではなく、通信がないことの保証にはならない。権限、通信、DOM の操作、依存追加は差分をレビューする。

`extension/` に Manifest V3 の拡張機能を置いている。Chrome の `chrome://extensions` でデベロッパーモードを有効にし、「パッケージ化されていない拡張機能を読み込む」から `extension/` を選択して読み込む。変更後は拡張機能を再読み込みし、対象ページも再読み込みする。

## ライセンス

[MIT License](LICENSE) のもとで公開する。
