# OSS Scout × Integration Architect

**v0.1 MVP** — GOAL（と、必要なら気になっているGitHub Repository）を入力として
受け取り、世界のOSSを **Capability単位** へ分解し、検証・ゲート通過させ、優れた
Capabilityだけを選び、重複と競合を解決し、**新しいPluginを実際に生成** して、
元より本当に良くなったかを検証します。

成果物はRepositoryのリストではありません。**OPTIMIZED PLUGIN** です。

```
Repositoryを集めるな。Capabilityを理解せよ。
Capabilityを並べるな。Goalに対して最適化せよ。
Pluginを束ねるな。再設計せよ。
統合して終わるな。改善を検証せよ。
```

## 再現手順

```bash
cd oss-integration
npm install
npm run build
npm test          # 63件（unit・Goal評価ケース・Schema適合・受入テスト）
```

### MODE C — BRING + OPTIMIZE（本MVPの最重要モード）

```bash
node dist/src/cli.js build \
  --goal "Claude Codeで最高品質のWebサイトを作れるPluginを作って" \
  --repo https://github.com/fixture-org/frontend-craft-plugin \
  --repo https://github.com/fixture-org/browser-qa-plugin \
  --repo https://github.com/fixture-org/a11y-guard-plugin \
  --name frontend-quality-plugin
```

`generated/plugins/frontend-quality-plugin/` に、実際のClaude Code Pluginと
`INTEGRATION_REPORT.md` / `VALIDATION_REPORT.md` / `PROVENANCE.md` を生成します。

### MODE A — GOAL ONLY

```bash
node dist/src/cli.js goal "Claude Codeで最高品質のWebサイトを作れるPluginを作って"
```

### MODE B — BYOT（Repository 1件の解析）

```bash
node dist/src/cli.js analyze --repo https://github.com/fixture-org/a11y-guard-plugin
```

### オプション

| フラグ | 意味 |
| --- | --- |
| `--live` | `raw.githubusercontent.com` と `registry.npmjs.org` から実Artifact（License本文・README・Package Metadata・公開Source）を取得してScanします。**既定はオフ**（再現性のため）。オフのとき未知のRepositoryは推測せず `UNKNOWN` になります。 |
| `--real-tasks` | Task Suiteを実ブラウザ・実ページで、全Subject同一条件で実行します。Chromiumの場所が異なる場合は `OSS_CHROMIUM_PATH` を設定してください。 |
| `--repeats <n>` | `--real-tasks` の反復回数。Reliabilityは `n > 1` が必要で、`n = 1` では `NOT_VERIFIED` のままです。 |
| `--out <dir>` | 出力先（既定 `generated/plugins`）。 |
| `--name <name>` | 生成Plugin名。 |
| `--json` | 機械可読出力。 |

## 処理フロー

```
USER GOAL + OPTIONAL USER-SUPPLIED OSS
  → Goal Engine ─ Capability分解（Repository名ではない）
  → Repository Analyzer ─ fixture / seed registry / live GitHub
  → Capability Extractor
  → Evidence Engine ─ VERIFIED > SUPPORTED > INFERRED > CLAIMED > UNKNOWN
  → License Gate / Security Gate ─ BLOCKはScoreより優先
  → Capability Graph ─ REQUIRES / COMPLEMENTS / ALTERNATIVE_TO /
                       CONFLICTS_WITH / UNLOCKS ＋ Near-Miss検出
  → Gap Engine ─ REQUIRED − CURRENT = MISSING（組合せでUNLOCKされる分は除く）
  → Global Discovery ─ 不足Capabilityを世界から探す
  → Duplicate / Conflict 検出
  → KEEP / REPLACE / ADD / REMOVE / WATCH / REJECT / UNKNOWN（すべて理由付き）
  → Best Capability Stack
  → Stack Optimizer ─ Evidenceを落とさずにSourceを集約
  → Integration Architect ─ 依存・競合・ワークフロー・アーキテクチャ再設計
  → Original Layer ─ このStackが必要とする場合のみ
  → Plugin Builder ─ 実際の .claude-plugin/ パッケージ
  → Validator ─ 元Plugin群 vs 統合Plugin を同一タスクで比較
  → FINAL PLUGIN
```

## このシステムが拒否すること

**Starsで評価しない。** PopularityはScout Scoreの5%に上限があり、
`classifyEvidence(['social-popularity'])` は `UNKNOWN` を返します。受入テストの
Fixtureでは、最もStarが多いRepository（4,300 stars）がHard Gateによって
REJECTされます。BLOCKはScoreより優先されるからです。

**Licenseを推測しない。** 観測できなかったLicenseは `UNKNOWN` であり、`UNKNOWN`
はコードのコピーを許しません。参照できるのはIdea・一般的手法・アーキテクチャ概念・
公開仕様のみで、実装は独立に行います。v0.1は第三者コードを一切コピーしないため、
`Reused Code: None` は約束ではなく構造的な事実です。

**測っていない改善を主張しない。** Output Quality / Execution Time / Reliability は
実ブラウザでSuiteを実行して測定済みです。UX / Setup Time / Token Usage は
代替指標で埋めずに `NOT_VERIFIED` のまま残し、測定された悪化はMaterialityとともに
すべて報告します。

## リリースステータス

```
BUILD STATUS          CONDITIONAL
RELEASE READINESS     READY_WITH_KNOWN_TRADEOFFS
IMPROVEMENT VERDICT   REGRESSION（FULL-CAPABILITY）
BENCHMARK POLICY      v0.1.1（v0.1は benchmark/baseline-v0.1.json に凍結）
FINAL RECOMMENDATION  SHIP_WITH_LIMITATIONS
```

詳細は **[FINAL_RELEASE_REPORT.md](./FINAL_RELEASE_REPORT.md)**、
判断根拠は **[DECISIONS.md](./DECISIONS.md)** を参照してください。

### 実行済みBenchmark — Fixture入力・実ブラウザ

`fixture-org` は**実在しない**組織です。この実行結果は実在プロジェクトに関する
主張ではありません。Capability Setは合成、実行は本物です。

| 指標 | 元Plugin最良 | originals-union | 統合Plugin | 判定 | Material |
| --- | --- | --- | --- | --- | --- |
| Task Completion | 0.25 | 0.5 | **1.0** | IMPROVED | — |
| Integration Debt | 3 | 6 | **0** | IMPROVED | — |
| Quality Criteria Covered | 3 | 4 | **7** | IMPROVED | — |
| Task Coverage / Install Action | 0.25 | 0.125 | **0.5** | IMPROVED | — |
| Output Quality / Error Rate / Security / Reliability | — | — | — | EQUIVALENT | — |
| Install Actions | 1 | 4 | 2 | REGRESSION | no |
| **Distinct Upstream Projects** | 1 | 3 | **5** | REGRESSION | **YES** |
| **Unscanned Dependencies** | 0 | 0 | **2**（`--live` で 0） | REGRESSION | **YES** |
| **Execution Time** | 246 ms | 235 ms | **556 ms** | REGRESSION | **YES** |
| **Time / Completed Task・Criterion** | 121.5 / 81.7 | 61 / 61 | **68.6 / 78.4** | REGRESSION | **YES** |
| UX / Setup Time / Token Usage | — | — | — | NOT_VERIFIED | — |

**Live実行**（実在Repository 3件）：Task Completion 0.75 IMPROVED、
Unscanned Dependencies **0**、Material Regressionは
Distinct Upstream Projects の**1件のみ**。

### 重要な2つの発見

**Execution Timeの差はOverheadではなく実作業である（証明済み）。** 同一4Task・
Capability Setを交差させ、どのSubjectも余分な作業をしない条件で比較：

| | originals-union | 統合Plugin | 判定 |
| --- | --- | --- | --- |
| Execution Time（SAME-TASK） | 256 ms | 252 ms | **EQUIVALENT** |

Material な Orchestration Overhead は検出されませんでした。差は実行ごとの
ノイズの範囲内であるため **EQUIVALENT** と判定し、「統合Pluginの方が速い」
とは主張しません。FULL-CAPABILITYでの差は、元Pluginが
一切実行できないAccessibility監査とVisual Regressionで完全に説明できます
（追加作業実測 ~315 ms に対し、実測差 ~316 ms）。ただしRaw Execution Timeの
REGRESSIONはそのまま残し、Verdictにも算入しています。SAME-TASKは診断用であり、
Headlineではありません。

最適化により **844 ms → 549 ms（−35%）**。Browser共有、axe-core Source Cache、
重複Screenshotの再利用、Cold StartをWarm-up Passへ退避。**Checkは一切
Skipしていません。**

**Project数はルールを破らずにこれ以上減らせません。** Upstream 4件すべてが
`ESSENTIAL` です。4件にする経路はいずれも、accessibility-auditをSecurity Gateの
弱いSource（axe-core・lighthouse）へ移すか、LGPL-3.0-onlyの `pa11y`（License Gate
の後退）へ移すか、Capabilityを落とすかを要求します。Optimizerは1つ目を試み、
**拒否しました。** Vendoringも検討し却下：Project数は減らず、Security責任だけが
本プロジェクトへ移るためです。

### レビュー状況

```
Independent Codex Review: Not Run
  理由: 本実行環境が OpenAI のネットワーク/認証アクセスを遮断しているため。
  分類: ENVIRONMENT_RESTRICTION — Product の欠陥ではありません。

CLAUDE SELF REVIEW: 19件の欠陥を発見・修正 — CHANGELOG.md 参照
```

**本コードは作者以外の誰からもレビューを受けていません。** Self Reviewは
特定の欠陥を発見した証拠ではありますが、コードが正しいことの証拠ではなく、
Independent Reviewの代替でもありません。

Independent Review Package は完成済みで、Codexがネットワークに到達できる環境
なら1コマンドで実行できます：

→ **[reports/codex-package/README.md](./reports/codex-package/README.md)**
→ Handoff状況: [CODEX_HANDOFF_REPORT.md](./CODEX_HANDOFF_REPORT.md)

## v0.1 完成条件

24項目すべて充足。`npm run verify` でビルドと92件のテスト、加えてLive Repository
テスト4件・実ブラウザテスト10件（共有BrowserのState Leakageが無いことを検証する
Cache Safetyテストを含む）が通ります。総合ステータスは PASS ではなく
**CONDITIONAL** です（Material Regressionが残存。詳細は
`FINAL_RELEASE_REPORT.md`）。

## ライセンス

MIT。[LICENSE](./LICENSE) を参照してください。
