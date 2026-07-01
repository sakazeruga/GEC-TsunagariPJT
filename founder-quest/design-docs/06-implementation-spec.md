# Founder Quest 実装仕様書(現状まとめ)

最終更新: 2026-07-02
対象リポジトリ: https://github.com/globisentrepreneursclub/GEC-TsunagariPJT
公開URL: https://globisentrepreneursclub.github.io/GEC-TsunagariPJT/

本ドキュメントは、企画・設計フェーズの `①〜⑤` 設計書群(`founder-quest/design-docs/`)を踏まえて実際に実装された内容を、現状のコードベースに合わせて記録するものです。設計書はコンセプト・あるべき姿を、本ドキュメントは「今実際に何がどう動いているか」を記述します。

---

## 1. 概要

- **プロダクト名**: Founder Quest(起業家RPG診断)
- **目的**: GEC(起業家コミュニティ)がメンバーの起業家タイプ・状態を可視化し、継続的にデータを蓄積するための診断ゲーム
- **現状のスコープ(実装済み)**:
  1. 40問サーベイ → 8パラメータ → 8キャラクター診断
  2. 診断結果のSupabaseへの永続化(匿名アカウント)
  3. 自己紹介カード画像の生成・シェア
  4. GEC運営向けの簡易データ閲覧・削除管理画面
  5. GitHub Pagesでの公開(GitHub Actions経由でSupabase認証情報を安全に注入)
- **未実装**(設計書には記載があるが未着手): アカウント登録/ログイン、継続的フェーズ更新、クエスト個人紐づけ、マッチング、ナレッジベース等。詳細は [12. 未実装・今後の課題](#12-未実装今後の課題) を参照。

---

## 2. 技術スタック

| レイヤー | 使用技術 |
|---|---|
| フロントエンド | Vanilla HTML / CSS / JavaScript(ビルドツールなし、フレームワークなし) |
| スタイリング | Tailwind CSS(CDN経由、`cdn.tailwindcss.com`) |
| フォント | Google Fonts(Noto Sans JP / Cinzel) |
| 画像生成 | html2canvas 1.4.1(CDN) |
| データベース | Supabase(PostgreSQL + PostgREST経由のREST API、`@supabase/supabase-js@2`) |
| ホスティング | GitHub Pages |
| CI/CD | GitHub Actions(カスタムワークフローでSupabase認証情報を注入) |

外部APIキーやSDKは全てCDN読み込みで、npm/ビルドステップは一切使用していない(「バイブコーディング」前提の軽量構成)。

---

## 3. ディレクトリ構成

```
GEC-TsunagariPJT/
├─ .github/workflows/
│   └─ deploy-pages.yml        # GitHub Actions: config.js生成 + Pagesデプロイ
├─ .claude/
│   └─ launch.json             # ローカルプレビュー用(python http.server)
├─ .gitignore                  # config.js・下書きdocx等を除外
├─ docs/                       # ← GitHub Pages 公開ルート
│   ├─ index.html              # 診断アプリ本体(全画面統合の単一HTML)
│   ├─ admin.html              # GEC運営向け データ閲覧・削除ページ
│   ├─ config.js               # Supabase接続情報(Git管理外。デプロイ時に自動生成)
│   ├─ config.example.js       # config.js のテンプレート(プレースホルダのみ)
│   ├─ data/
│   │   ├─ questions.js        # 40問の設問データ
│   │   └─ characters.js       # 8キャラクターマスタ
│   ├─ lib/
│   │   └─ diagnosis.js        # スコアリング・キャラ判定ロジック
│   └─ README.md
└─ founder-quest/               # 企画・設計資料(参照用、アプリの動作には無関係)
    ├─ vibe-coding-dev-instructions.docx
    ├─ design-docs/
    │   ├─ 01-concept-design.docx
    │   ├─ 02-diagnosis-logic-spec.docx
    │   ├─ 03-character-design.docx
    │   ├─ 04-screen-flow-ux-design.docx
    │   ├─ 05-mvp-dev-spec.docx
    │   └─ 06-implementation-spec.md   # 本ファイル
    └─ source-docs/
        ├─ characters-master-json.docx
        ├─ diagnosis-logic-notes.docx
        └─ questions-master-json.docx
```

GitHub Pagesは `/(root)` でも `/docs` でも公開元に指定できる仕様のため、アプリ本体は `docs/` に配置し、企画資料は `founder-quest/` にまとめて分離している。

---

## 4. 診断ロジック仕様

### 4.1 設問構成(全40問、`data/questions.js`)

| 種別 | 問数 | 加点方式 |
|---|---|---|
| 5段階評価(scale) | 24問 | 選択値(1〜5点)をそのまま対応パラメータに加算 |
| シナリオ選択(scenario) | 8問 | 選んだ選択肢の対応パラメータに +2点 |
| 価値観選択(value) | 4問 | 選んだ選択肢の対応パラメータに +3点 |
| 自由記述(free_text) | 4問(Q37〜Q40) | スコア対象外。回答内容のみ保存 |

### 4.2 8パラメータ

`VISION`(ビジョン力)/ `ACTION`(実行力)/ `EMPATHY`(共感力)/ `ANALYSIS`(分析力)/ `CREATIVE`(創造力)/ `RISK`(挑戦力)/ `TEAM`(巻き込み力)/ `PERSIST`(継続力)

### 4.3 8キャラクター と 判定式(`lib/diagnosis.js`)

| id | 名前 | タイプ | 判定式 |
|---|---|---|---|
| hero | 勇者 | ビジョン牽引型 | `VISION×1.5 + TEAM×1.0 + RISK×0.8` |
| warrior | 戦士 | 実行突破型 | `ACTION×1.5 + PERSIST×1.0 + RISK×0.8` |
| monk | 僧侶 | 共感支援型 | `EMPATHY×1.5 + PERSIST×1.0 + TEAM×0.8` |
| mage | 魔法使い | 創造発明型 | `CREATIVE×1.5 + VISION×1.0 + ANALYSIS×0.8` |
| thief | 盗賊 | 機会発見型 | `RISK×1.5 + CREATIVE×1.0 + ACTION×0.8` |
| merchant | 商人 | 事業設計型 | `ANALYSIS×1.5 + EMPATHY×1.0 + PERSIST×0.8` |
| strategist | 軍師 | 戦略分析型 | `ANALYSIS×1.5 + VISION×1.0 + TEAM×0.8` |
| summoner | 召喚士 | チーム形成型 | `TEAM×1.5 + EMPATHY×1.0 + VISION×0.8` |

判定フロー(`determineCharacter()`):
1. 8キャラクターのスコアを降順ソート
2. 最高スコア → メインキャラ、2位 → サブキャラ
3. `メインスコア - サブスコア <= 3` の場合、`isHybrid = true`(ハイブリッドタイプとして表示)

`normalizeScores()` により各パラメータを0〜100%に正規化してステータスバー表示に使用。

---

## 5. 画面構成(`docs/index.html`、単一HTML内の10画面切り替え)

| # | screen id | 内容 |
|---|---|---|
| 1 | `screen-top` | トップページ |
| 2 | `screen-start` | 診断開始案内 |
| 3 | `screen-profile` | ニックネーム・起業経験・関心テーマ入力 |
| 4 | `screen-survey` | 40問サーベイ |
| 5 | `screen-analyzing` | 診断中演出(パラメータバーのアニメーション) |
| 6 | `screen-reveal` | キャラ出現(メイン/サブ/ハイブリッドバッジ) |
| 7 | `screen-detail` | 診断結果詳細(ステータス・強み・伸びしろ・相性) |
| 8 | `screen-quest` | 初回クエスト提示 |
| 9 | `screen-share` | 結果共有(自己紹介カード・テキストコピー) |
| 10 | `screen-room` | 簡易マイルーム(再診断導線含む) |

画面遷移は `goTo(screenName)` が担い、`.screen.active` クラスの付け替えのみで実装(ルーティングなし、SPA的な単一ページ)。

状態は `S`(グローバルオブジェクト: nickname/stage/interests/answers/result)で管理し、`localStorage`(`fq_state`)に都度保存。再訪問時は保存結果を復元するトースト通知が出る。

---

## 6. 自己紹介カード画像機能

- `screen-share` 内の `#share-card` 要素(キャラ名・タイプ・キャッチコピー・8パラメータ・強みタグ)を html2canvas でキャプチャして画像化
- カードの背景グラデーション・枠線色はキャラの `themeColor`(`data/characters.js`)を反映して動的に変化
- 生成した画像は:
  - `navigator.share` + `navigator.canShare({files:[...]})` に対応する環境ではネイティブ共有シートを使用
  - 非対応環境ではPNGファイルとしてダウンロード(`<a download>`)
- **既知の実装上の注意**: html2canvasはキャプチャ処理中に一時的にページのスクロール位置を変更することがあるため、`saveOrShareCardImage()` 内で処理前後のスクロール位置を保存・復元している(`finally` 節で必ず復元)。

---

## 7. データ永続化(Supabase)

### 7.1 テーブル定義

```sql
create table diagnosis_results (
  id uuid primary key default gen_random_uuid(),
  device_id text not null,
  nickname text,
  stage text,
  interests text[],
  free_text_answers jsonb,
  parameter_scores jsonb not null,
  main_character text not null,
  sub_character text not null,
  is_hybrid boolean not null default false,
  created_at timestamptz not null default now()
);

alter table diagnosis_results enable row level security;
```

### 7.2 RLS(Row Level Security)ポリシー

| 操作 | 対象ロール | 状態 |
|---|---|---|
| INSERT | anon | 許可(`with check (true)`) |
| SELECT | anon | 許可(`using (true)`) |
| UPDATE | - | 未許可 |
| DELETE | anon(直接) | **未許可**。削除は下記RPC関数経由のみ |

```sql
create policy "allow anonymous insert" on diagnosis_results for insert to anon with check (true);
create policy "allow anon select"      on diagnosis_results for select to anon using (true);
```

### 7.3 削除用RPC関数(サーバー側パスコードチェック)

admin.html の削除ボタンは、anonロールに生のDELETE権限を渡すのではなく、パスコード検証を行う `SECURITY DEFINER` 関数経由でのみ削除を許可する設計。

```sql
create or replace function delete_diagnosis_result(row_id uuid, passcode text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if passcode <> 'globis' then
    raise exception 'invalid passcode';
  end if;
  delete from diagnosis_results where id = row_id;
end;
$$;

grant execute on function delete_diagnosis_result(uuid, text) to anon;
```

### 7.4 匿名デバイスID

- `localStorage` の `fq_device_id` に `crypto.randomUUID()` で生成したUUIDを保持
- アカウント機能がないため、同一端末からの再診断を緩やかに紐づけるための仮ID(未ログイン運用)

### 7.5 保存処理

- `docs/index.html` の `startAnalyzing()` 内、診断結果確定直後に非同期で `saveResultToSupabase(result)` を呼び出す
- **保存失敗しても診断フロー自体は止めない**設計(`try/catch` で握りつぶし、`console.error` のみ)
- `supabaseClient` は `config.js` が存在しない/未設定の場合 `null` のままとなり、Supabase関連処理は安全にスキップされる(後述7.6のインシデントを踏まえた防御的実装)

### 7.6 過去に発生した障害の記録(教訓)

1. **config.js未整備によるアプリ全体クラッシュ**: `config.js` をGit管理外にした結果、GitHub Pages本番環境にこのファイルが存在せず、`SUPABASE_URL.startsWith(...)` の直接参照がReferenceErrorを起こし、以降の `let S = {...}` が初期化されないまま残り、サーベイ開始時に `Cannot access 'S' before initialization` でクラッシュしていた。`typeof` ガードを追加して修正済み(現在のコードは7.5の通り安全)。
2. **DELETE文の誤爆による全データ消失**: SQL Editorで案内した「特定行を消す例」と「全件消す例」の両方を実行してしまい、`diagnosis_results` が全件削除される事故が発生。Supabase無料プランには自動バックアップ・Point-in-Time Recoveryが無いため、当該データは復旧不可能だった。この教訓から、admin.html上の削除操作には7.3のRPC(パスコード必須)を採用し、SQL Editorでの操作を行う際は必ず先にSELECTで対象行を確認する運用ルールとした。

---

## 8. 管理画面(`docs/admin.html`)

- **アクセス制御**: 共通パスワード(`globis`)によるクライアントサイドのゲート
  - ⚠️ これはUX上のゲートであり、真のアクセス制御ではない。anonキーとテーブル名を知っていれば、ページを介さず直接Supabase REST APIを叩いて同じデータを閲覧すること自体は技術的に可能(SELECTポリシーがanonに対してusing(true)のため)
  - ただし**削除操作のみ**は7.3のRPC関数によりサーバー側でパスコード照合されるため、実質的な保護がかかっている
- **一覧表示項目**: 日時・ニックネーム・フェーズ・関心テーマ・メインキャラ・サブキャラ・Hybrid(✨表示)・8パラメータ・自由記述(Q37〜Q40)
- **検索**: ニックネームによる部分一致フィルタ
- **再読込ボタン**: `diagnosis_results` を `created_at` 降順で再取得(最大1000件)
- **削除ボタン**: 各行に配置。`confirm()` による確認必須 → `delete_diagnosis_result` RPCを呼び出し
- **エラーハンドリング**: データ取得は `try/catch` で必ずステータス表示を更新するため、「読み込み中...」のまま無限に固まることはない(過去に発生した不具合を修正済み)

---

## 9. デプロイ・CI/CD

### 9.1 構成

- リポジトリオーナー: `globisentrepreneursclub`(GitHub Organization。個人アカウントから移管済み)
- GitHub Pages Source: **GitHub Actions**(ブランチデプロイ方式ではない)
- ワークフロー: `.github/workflows/deploy-pages.yml`

```yaml
on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deploy:
    steps:
      - uses: actions/checkout@v4
      - name: Generate config.js from secret
        run: |
          cat <<'EOF' > docs/config.js
          ${{ secrets.CONFIGJS }}
          EOF
      - uses: actions/upload-pages-artifact@v3
        with: { path: docs }
      - uses: actions/deploy-pages@v4
```

- リポジトリSecrets: **`CONFIGJS`** という1つのSecretに `config.js` の内容一式(`SUPABASE_URL`/`SUPABASE_ANON_KEY` の定義2行)をそのまま格納
- `concurrency` 設定により、短時間に連続pushしても最新のデプロイのみが有効になる(過去に連続push起因でデプロイが競合キャンセルされた問題への対応)

### 9.2 ローカル開発

- `.claude/launch.json` で `python -m http.server` を `docs/` に対して起動する設定
- ローカルの `docs/config.js` は `.gitignore` 対象で、開発者が手元で `config.example.js` をコピーして実際の値を入れて使用する

---

## 10. セキュリティ設計まとめ

| 項目 | 方針 |
|---|---|
| Supabase anonキー | クライアントサイドに公開される前提の鍵(Supabase標準仕様)。RLSで保護する設計 |
| Git管理 | `config.js`(実際の鍵を含むファイル)はGit履歴に一切含めない。本番投入はGitHub Actions Secrets経由 |
| 閲覧(SELECT) | anonロールに許可(RLS)。admin.htmlのパスワードはUX上のゲートに留まる(既知の制約として明記) |
| 削除(DELETE) | anonロールへの直接付与はせず、パスコード検証込みのRPC関数のみ許可 |
| バックアップ | Supabase無料プランのため自動バックアップ・PITRなし。破壊的SQLは事前SELECT確認を運用ルール化 |

---

## 11. 主要な設計変更の経緯(サマリ)

1. 当初、認証情報を `index.html` に直書き → リポジトリがPublicになったタイミングで指摘を受け、`config.js`(Git管理外)に分離
2. その結果、GitHub Pages本番に `config.js` が存在せず全体がクラッシュする問題が発覚 → 防御的コードに修正 + GitHub Actionsでのconfig.js自動生成に方式変更
3. フォルダ構成が日本語名でGitHub Pagesからアクセスしづらい問題 → リポジトリ全体を英語フォルダ名に再構成(`docs/`, `founder-quest/design-docs/`, `founder-quest/source-docs/`)
4. admin.html運用中にSQL誤操作で全データ消失 → 削除機能をRPC経由のパスコード必須方式に変更、ダミーデータで復旧

---

## 12. 未実装・今後の課題

設計書(`①〜⑤`)およびゲーミフィケーション構想メモに記載されているが、現時点で未着手の機能:

- アカウント登録・ログイン機能(現状は匿名 `device_id` のみで個人を継続追跡できない)
- 継続的なフェーズ更新・半年後アップデート通知
- クエストと個人の紐づけ(スキルセット・1on1)
- レベル/達成率スコアの可視化・シェア
- 起業家同士・VCとのマッチング機能
- ナレッジベース・「陥りがちな罠」コンテンツ
- Supabase anonキーのローテーション(過去に一時的にリポジトリへ露出した経緯があるため、念のため実施を推奨)
