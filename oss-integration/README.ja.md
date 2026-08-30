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
npm test          # 62件（unit・Goal評価ケース・Schema適合・受入テスト）
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
| `--live` | GitHub APIへのアクセスを許可。**既定はオフ**（再現性のため）。オフのとき、未知のRepositoryは推測せず明示的に `UNKNOWN` になります。レート制限対策に `GITHUB_TOKEN` を設定してください。 |
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

**測っていない改善を主張しない。** v0.1のBenchmarkは静的なCapability Coverageです。
Output Quality / Reliability / UX / Token Usage は `NOT_VERIFIED` と報告し、
測定された悪化は `REGRESSION DETECTED` として報告します。

## 参照ビルドのBenchmark結果

| 指標 | 元Pluginの最良値 | 統合Plugin | 判定 |
| --- | --- | --- | --- |
| Task Completion（9タスク） | 0.222 | **0.889** | IMPROVED |
| Maintainability（重複＋未解決Conflict） | 3 | **1** | IMPROVED |
| Security（high/critical件数） | 0 | 0 | EQUIVALENT |
| Error Rate | 0 | 0.5 | REGRESSION |
| Capability Coverage / Install Source | 0.222 | 0.178 | REGRESSION |
| Output Quality / Reliability / UX / Token Usage | — | — | NOT_VERIFIED |

**総合: REGRESSION**。これは実行の失敗ではなく、正直な結果です。統合Pluginは
4倍のタスクを1/6のIntegration Debtでカバーしますが、2つの実コストがあります。

- **Error Rate**: 実行可能タスクの半分が、Sourceのセキュリティ走査を一度も
  受けていないCapabilityに依存します。オフライン実行では走査対象のArtifactが
  存在しないため `securityStatus: UNKNOWN` となり、UNKNOWNはPASSではありません。
- **Install Sourceあたりのカバレッジ**: v0.1のNo-Vendoring方針により、生成Pluginは
  Upstreamツールを内包せずオーケストレーションするため、選択したSourceはそれぞれ
  別インストールのまま残ります。

いずれも [CHANGELOG.md](./CHANGELOG.md) に対処方針を記載しています。指標を
調整せずそのまま報告することが、ルール30の趣旨です。

## v0.1 完成条件

24項目すべて充足。`npm run verify` でビルドと全テストが通り、`build` コマンドは
構造検証をPASSするPluginを生成します。

## ライセンス

MIT。[LICENSE](./LICENSE) を参照してください。
