"""Bundled test suite. Run with `python3 scripts/kumiki.py selftest`.

Nothing here touches the network: the fetch layer is exercised through its
pure helpers, and everything else works on fixtures in a temp directory.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import unittest

PLUGIN_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(PLUGIN_ROOT, "scripts"))

from kumikilib import cache, extract, gather, htmldom, knowledge, thrift, tokens  # noqa: E402
from kumikilib.fetcher import Fetcher, _decode, normalise_url  # noqa: E402

SAMPLE_HTML = """<!doctype html>
<html lang="ja"><head>
<title>駅ナカ土産の最新動向 | 菓子新聞</title>
<meta property="og:site_name" content="菓子新聞">
<meta name="description" content="駅ナカ土産の販売動向を分析">
<link rel="canonical" href="/news/2026/ekinaka">
<script type="application/ld+json">
{"@type":"NewsArticle","headline":"駅ナカ土産の最新動向",
 "datePublished":"2026-08-01","author":{"name":"編集部"}}
</script>
</head><body>
<nav class="global-nav"><a href="/">HOME</a><a href="/a">A</a></nav>
<main><article class="post" id="a1">
<h1>駅ナカ土産の最新動向</h1>
<p>2026年上期は<strong>前年比112%</strong>で推移した。</p>
<h2>チャネル別</h2>
<ul><li>駅ナカ<li>空港<ul><li>国内線<li>国際線</ul><li>道の駅</ul>
<table><tr><th>チャネル<th>構成比<tr><td>駅ナカ<td>32%<tr><td>空港<td>18%</table>
<p>詳細は<a href="/report/2026">レポート</a>を参照。</p>
<script>var tracker = 1;</script>
</article></main>
<div class="related-posts">関連記事</div>
<footer>© 菓子新聞</footer></body></html>"""


class TestTokens(unittest.TestCase):
    def test_japanese_costs_more_per_character_than_ascii(self):
        japanese = tokens.estimate("お土産お菓子")
        ascii_text = tokens.estimate("omiyage okashi")
        self.assertGreater(japanese / 6, ascii_text / 14)

    def test_empty_string_is_zero(self):
        self.assertEqual(tokens.estimate(""), 0)

    def test_script_split_adds_up(self):
        counts = tokens.count_scripts("abc日本語")
        self.assertEqual(counts["total"], 6)
        self.assertEqual(counts["cjk"], 3)
        self.assertEqual(counts["latin"], 3)

    def test_human_formats_thousands(self):
        self.assertEqual(tokens.human(999), "999")
        self.assertEqual(tokens.human(15234), "15.2k")
        self.assertTrue(tokens.human(2_500_000).endswith("M"))

    def test_truncate_respects_budget(self):
        text = "あああ。いいい。ううう。" * 40
        trimmed = tokens.truncate_to_tokens(text, 40)
        self.assertLessEqual(tokens.estimate(trimmed), 48)
        self.assertLess(len(trimmed), len(text))

    def test_truncate_returns_input_when_it_fits(self):
        self.assertEqual(tokens.truncate_to_tokens("short", 1000), "short")

    def test_pack_drops_what_does_not_fit(self):
        kept, dropped = tokens.pack(
            [("a", "x" * 40), ("b", "y" * 4000), ("c", "z" * 40)], 40)
        self.assertEqual([label for label, _ in kept], ["a", "c"])
        self.assertEqual(dropped, ["b"])


class TestHtmlDom(unittest.TestCase):
    def setUp(self):
        self.dom = htmldom.parse(SAMPLE_HTML)

    def test_implied_close_splits_paragraphs(self):
        dom = htmldom.parse("<div><p>one<p>two</div>")
        self.assertEqual(len(dom.select("div > p")), 2)

    def test_implied_close_splits_list_items(self):
        items = self.dom.select("li")
        self.assertEqual(len(items), 5)
        # A nested <ul> belongs to its parent <li>, so that item's text_content
        # legitimately contains the sub-items.
        self.assertEqual(items[0].text_content(), "駅ナカ")
        self.assertEqual(items[1].find("ul").find_all("li")[0].text_content(),
                         "国内線")
        self.assertEqual(items[-1].text_content(), "道の駅")

    def test_child_combinator_is_not_descendant(self):
        self.assertEqual(len(self.dom.select("article > p")), 2)
        self.assertEqual(len(self.dom.select("article p")), 2)
        self.assertEqual(len(self.dom.select("main li")), 5)

    def test_attribute_operators(self):
        self.assertIsNotNone(self.dom.select_one("article[id^=a]"))
        self.assertIsNotNone(self.dom.select_one("article[id$=1]"))
        self.assertIsNotNone(self.dom.select_one("article[id*=a]"))
        self.assertIsNone(self.dom.select_one("article[id=nope]"))

    def test_selector_groups_union_in_document_order(self):
        found = [n.tag for n in self.dom.select("h1, footer")]
        self.assertEqual(found, ["h1", "footer"])

    def test_class_selector_requires_all_classes(self):
        dom = htmldom.parse('<div class="a b">x</div>')
        self.assertEqual(len(dom.select(".a.b")), 1)
        self.assertEqual(len(dom.select(".a.c")), 0)

    def test_stray_close_tag_does_not_break_tree(self):
        dom = htmldom.parse("<div><p>a</span></p></div>")
        self.assertEqual(len(dom.select("div p")), 1)

    def test_unclosed_tags_still_parse(self):
        dom = htmldom.parse("<div><span>a<div>b")
        self.assertEqual(len(dom.find_all("div")), 2)


class TestExtract(unittest.TestCase):
    def test_metadata_prefers_json_ld(self):
        meta = extract.extract_metadata(SAMPLE_HTML, "https://ex.jp/news/2026/ekinaka")
        self.assertEqual(meta["title"], "駅ナカ土産の最新動向")
        self.assertEqual(meta["published"], "2026-08-01")
        self.assertEqual(meta["author"], "編集部")
        self.assertEqual(meta["site_name"], "菓子新聞")
        self.assertEqual(meta["lang"], "ja")
        self.assertIn("NewsArticle", meta["jsonld_types"])

    def test_canonical_is_made_absolute(self):
        meta = extract.extract_metadata(SAMPLE_HTML, "https://ex.jp/news/2026/ekinaka")
        self.assertEqual(meta["canonical"], "https://ex.jp/news/2026/ekinaka")

    def test_main_content_drops_chrome(self):
        markdown = extract.html_to_markdown(SAMPLE_HTML, "https://ex.jp/x")
        self.assertIn("前年比112%", markdown)
        self.assertNotIn("HOME", markdown)
        self.assertNotIn("関連記事", markdown)
        self.assertNotIn("© 菓子新聞", markdown)
        self.assertNotIn("tracker", markdown)

    def test_markdown_structures_are_preserved(self):
        markdown = extract.html_to_markdown(SAMPLE_HTML, "https://ex.jp/x")
        self.assertIn("# 駅ナカ土産の最新動向", markdown)
        self.assertIn("## チャネル別", markdown)
        self.assertIn("**前年比112%**", markdown)
        self.assertIn("| チャネル | 構成比 |", markdown)
        self.assertIn("- 駅ナカ", markdown)
        self.assertIn("  - 国内線", markdown)

    def test_relative_links_become_absolute(self):
        markdown = extract.html_to_markdown(SAMPLE_HTML, "https://ex.jp/news/2026/x")
        self.assertIn("(https://ex.jp/report/2026)", markdown)

    def test_extract_links_filters_by_host_and_scheme(self):
        html = ('<a href="/a">a</a><a href="https://other.jp/b">b</a>'
                '<a href="mailto:x@y.jp">c</a><a href="#top">d</a>')
        same = extract.extract_links(html, "https://ex.jp/", same_host_only=True)
        self.assertEqual(same, ["https://ex.jp/a"])
        both = extract.extract_links(html, "https://ex.jp/", same_host_only=False)
        self.assertEqual(len(both), 2)


class TestFetcherHelpers(unittest.TestCase):
    def test_normalise_strips_fragment_and_default_port(self):
        self.assertEqual(normalise_url("https://ex.jp:443/a?q=1#frag"),
                         "https://ex.jp/a?q=1")
        self.assertEqual(normalise_url("http://ex.jp:80"), "http://ex.jp/")

    def test_decode_uses_declared_charset(self):
        self.assertEqual(_decode("日本語".encode("cp932"),
                                 "text/html; charset=Shift_JIS"), "日本語")

    def test_decode_falls_back_to_meta_charset(self):
        raw = '<meta charset="euc-jp">'.encode("ascii") + "日本語".encode("euc-jp")
        self.assertIn("日本語", _decode(raw, ""))

    def test_retry_after_header_is_honoured(self):
        self.assertEqual(Fetcher._retry_after({"retry-after": "7"}, 0), 7.0)

    def test_retry_backoff_grows(self):
        first = Fetcher._retry_after({}, 0)
        third = Fetcher._retry_after({}, 3)
        self.assertGreater(third, first)


class TestGather(unittest.TestCase):
    def test_slug_keeps_japanese(self):
        self.assertEqual(gather.slugify("駅ナカ土産の最新動向 | 菓子新聞"),
                         "駅ナカ土産の最新動向-菓子新聞")

    def test_slug_never_empty(self):
        self.assertEqual(gather.slugify("!!!"), "untitled")

    def test_front_matter_quotes_risky_scalars(self):
        rendered = gather._front_matter({"title": "a: b", "n": 3, "skip": ""})
        self.assertIn('title: "a: b"', rendered)
        self.assertIn("n: 3", rendered)
        self.assertNotIn("skip", rendered)

    def test_select_fields_scalar_and_list(self):
        html = '<div class="p"><h2>抹茶</h2><span class="price">1,280円</span>' \
               '<span class="price">980円</span></div>'
        record = gather.select_fields(html, "u", {
            "name": ".p h2", "price": ".price", "missing": ".nope"})
        self.assertEqual(record["name"], "抹茶")
        self.assertEqual(record["price"], ["1,280円", "980円"])
        self.assertIsNone(record["missing"])

    def test_document_roundtrip_writes_front_matter_and_manifest(self):
        document = gather.build_document(
            "https://ex.jp/x", SAMPLE_HTML, "2026-08-29T00:00:00Z", False, 200)
        markdown = document.to_markdown()
        self.assertTrue(markdown.startswith("---\n"))
        self.assertIn("source: ", markdown)
        self.assertIn("content_hash: ", markdown)
        with tempfile.TemporaryDirectory() as directory:
            manifest = gather.write_notes([document], directory)
            self.assertEqual(manifest["count"], 1)
            self.assertTrue(os.path.exists(
                os.path.join(directory, "_manifest.json")))
            self.assertGreater(manifest["total_est_tokens"], 0)

    def test_write_notes_disambiguates_colliding_titles(self):
        documents = [
            gather.build_document("https://ex.jp/1", SAMPLE_HTML, "t", False, 200),
            gather.build_document("https://ex.jp/2", SAMPLE_HTML, "t", False, 200),
        ]
        with tempfile.TemporaryDirectory() as directory:
            manifest = gather.write_notes(documents, directory)
            names = sorted(e["file"] for e in manifest["documents"])
            self.assertEqual(len(set(names)), 2)


class TestCache(unittest.TestCase):
    def test_put_then_get_roundtrips(self):
        with tempfile.TemporaryDirectory() as directory:
            store = cache.Cache(directory)
            store.put("https://ex.jp/a", {"body": "hi", "status": 200})
            hit = store.get("https://ex.jp/a")
            self.assertIsNotNone(hit)
            self.assertEqual(hit["body"], "hi")
            self.assertTrue(hit["from_cache"])
            self.assertEqual(store.stats()["hits"], 1)

    def test_miss_on_unknown_url(self):
        with tempfile.TemporaryDirectory() as directory:
            self.assertIsNone(cache.Cache(directory).get("https://ex.jp/none"))

    def test_disabled_cache_never_stores(self):
        with tempfile.TemporaryDirectory() as directory:
            store = cache.Cache(directory, enabled=False)
            store.put("https://ex.jp/a", {"body": "hi"})
            self.assertIsNone(store.get("https://ex.jp/a"))

    def test_purge_removes_everything_at_zero_age(self):
        with tempfile.TemporaryDirectory() as directory:
            store = cache.Cache(directory)
            store.put("https://ex.jp/a", {"body": "hi"})
            self.assertEqual(store.purge(older_than=0), 1)


class TestThrift(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.mkdtemp()
        self.markdown = os.path.join(self.directory, "doc.md")
        with open(self.markdown, "w", encoding="utf-8") as handle:
            handle.write("# 概要\n本文A\n\n## 価格戦略\n本文B\n\n### 原価\n"
                         "本文C\n\n## 販路\n本文D\n")
        self.python = os.path.join(self.directory, "mod.py")
        with open(self.python, "w", encoding="utf-8") as handle:
            handle.write("import os\n\n\ndef alpha():\n    pass\n\n\n"
                         "class Beta:\n    def gamma(self):\n        pass\n")
        # An index only pays for itself on a corpus with real bodies under the
        # headings, so the scale test needs files that are not toy-sized.
        self.corpus = os.path.join(self.directory, "corpus")
        os.makedirs(self.corpus, exist_ok=True)
        for n in range(6):
            with open(os.path.join(self.corpus, "note{}.md".format(n)), "w",
                      encoding="utf-8") as handle:
                handle.write("# 資料{}\n".format(n)
                             + "".join("## 節{}\n{}\n".format(i, "本文。" * 120)
                                       for i in range(5)))

    def tearDown(self):
        import shutil
        shutil.rmtree(self.directory, ignore_errors=True)

    def test_outline_finds_markdown_headings_with_ranges(self):
        data = thrift.outline(self.markdown)
        titles = [s["title"] for s in data["sections"]]
        self.assertEqual(titles, ["概要", "価格戦略", "原価", "販路"])
        self.assertEqual(data["sections"][1]["level"], 2)
        self.assertGreater(data["sections"][0]["end_line"],
                           data["sections"][0]["line"])

    def test_outline_finds_python_symbols(self):
        titles = [s["title"] for s in thrift.outline(self.python)["sections"]]
        self.assertIn("def alpha", titles)
        self.assertIn("class Beta", titles)
        self.assertIn("def gamma", titles)

    def test_outline_is_cheaper_than_the_file(self):
        data = thrift.outline(self.markdown)
        self.assertLess(data["outline_est_tokens"], data["total_est_tokens"])

    def test_slice_includes_subsections_by_default(self):
        section = thrift.slice_section(self.markdown, "価格戦略")
        self.assertIn("本文B", section["text"])
        self.assertIn("### 原価", section["text"])
        self.assertNotIn("本文D", section["text"])

    def test_slice_can_exclude_subsections(self):
        section = thrift.slice_section(self.markdown, "価格戦略",
                                       include_subsections=False)
        self.assertNotIn("### 原価", section["text"])

    def test_slice_matches_partial_heading(self):
        self.assertIsNotNone(thrift.slice_section(self.markdown, "価格"))

    def test_slice_returns_none_when_absent(self):
        self.assertIsNone(thrift.slice_section(self.markdown, "存在しない見出し"))

    def test_index_is_much_cheaper_than_the_corpus(self):
        data = thrift.build_index(self.corpus)
        self.assertEqual(data["files"], 6)
        # The whole point: the map costs a small fraction of the territory.
        self.assertLess(data["index_est_tokens"], data["corpus_est_tokens"] * 0.2)
        self.assertIn("| file | tok | title | sections |",
                      thrift.render_index(data))

    def test_budget_sorts_by_cost_and_labels_verdicts(self):
        data = thrift.budget([self.markdown, self.python])
        costs = [e["est_tokens"] for e in data["entries"]]
        self.assertEqual(costs, sorted(costs, reverse=True))
        self.assertTrue(all(e["verdict"] for e in data["entries"]))

    def test_plan_never_exceeds_its_budget(self):
        data = thrift.plan([self.markdown, self.python], 100000)
        self.assertLessEqual(data["planned_spend"], 100000)
        self.assertEqual(
            len(data["read_whole"]) + len(data["outline_first"])
            + len(data["search_only"]), 2)

    def test_plan_with_no_budget_reads_nothing_whole(self):
        data = thrift.plan([self.markdown, self.python], 0)
        self.assertEqual(data["read_whole"], [])


class TestKnowledge(unittest.TestCase):
    def setUp(self):
        self.root = tempfile.mkdtemp()
        knowledge.init_vault(self.root, "test")

    def tearDown(self):
        import shutil
        shutil.rmtree(self.root, ignore_errors=True)

    def write(self, relative, text):
        path = os.path.join(self.root, relative)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as handle:
            handle.write(text)
        return path

    def checks(self, data):
        return {f["check"] for f in data["findings"]}

    def test_init_creates_the_four_layers(self):
        for directory in knowledge.VAULT_DIRECTORIES:
            self.assertTrue(os.path.isdir(os.path.join(self.root, directory)))
        self.assertTrue(os.path.exists(os.path.join(self.root, "kumiki.json")))

    def test_init_is_idempotent(self):
        again = knowledge.init_vault(self.root, "test")
        self.assertEqual(again["created"], [])

    def test_front_matter_parses_scalars_and_lists(self):
        fields, body = knowledge.parse_front_matter(
            '---\ntitle: "a: b"\nn: 12\nflag: true\ntags:\n  - x\n  - y\n---\n\nbody\n')
        self.assertEqual(fields["title"], "a: b")
        self.assertEqual(fields["n"], 12)
        self.assertIs(fields["flag"], True)
        self.assertEqual(fields["tags"], ["x", "y"])
        self.assertEqual(body.strip(), "body")

    def test_front_matter_absent_returns_original(self):
        fields, body = knowledge.parse_front_matter("# heading\n")
        self.assertEqual(fields, {})
        self.assertEqual(body, "# heading\n")

    def test_missing_source_is_flagged(self):
        self.write("notes/a.md", "# 考察\n本文\n")
        self.assertIn("missing-source", self.checks(knowledge.audit(self.root)))

    def test_source_in_front_matter_clears_the_flag(self):
        self.write("notes/a.md",
                   "---\ntitle: T\nsource: ../sources/x.md\nupdated: 2026-08-01\n---\n本文\n")
        findings = [f for f in knowledge.audit(self.root)["findings"]
                    if f["check"] == "missing-source"]
        self.assertEqual(findings, [])

    def test_unbacked_japanese_figures_are_flagged(self):
        self.write("notes/a.md", "# 考察\n駅ナカは32%、空港は18%、ECは12万件。\n")
        self.assertIn("unbacked-figures", self.checks(knowledge.audit(self.root)))

    def test_broken_relative_link_is_an_error(self):
        self.write("notes/a.md", "# T\n[x](../sources/missing.md)\n")
        errors = [f for f in knowledge.audit(self.root)["findings"]
                  if f["check"] == "broken-link"]
        self.assertEqual(len(errors), 1)
        self.assertEqual(errors[0]["severity"], "error")

    def test_existing_link_is_not_flagged(self):
        self.write("sources/x.md", "---\nsource: https://ex.jp\n---\n本文\n")
        self.write("notes/a.md",
                   "---\nsource: ../sources/x.md\n---\n[x](../sources/x.md)\n")
        self.assertNotIn("broken-link", self.checks(knowledge.audit(self.root)))

    def test_stale_dates_are_flagged(self):
        self.write("sources/old.md",
                   "---\ntitle: T\nsource: https://ex.jp\nfetched_at: 2020-01-01\n---\n本文\n")
        self.assertIn("stale", self.checks(knowledge.audit(self.root)))

    def test_stale_threshold_can_be_relaxed(self):
        self.write("sources/old.md",
                   "---\ntitle: T\nsource: https://ex.jp\nfetched_at: 2020-01-01\n---\n本文\n")
        data = knowledge.audit(self.root, stale_days=100000)
        self.assertNotIn("stale", self.checks(data))

    def test_oversize_notes_are_flagged(self):
        self.write("notes/big.md",
                   "---\nsource: https://ex.jp\n---\n" + ("長い本文。" * 3000))
        self.assertIn("oversize", self.checks(knowledge.audit(self.root)))

    def test_duplicate_titles_are_flagged(self):
        self.write("notes/a.md", "---\nsource: s\ntitle: 同名\n---\n本文\n")
        self.write("notes/b.md", "---\nsource: s\ntitle: 同名\n---\n本文\n")
        self.assertIn("duplicate-title", self.checks(knowledge.audit(self.root)))

    def test_orphan_notes_are_reported_as_info(self):
        self.write("notes/lonely.md", "---\nsource: s\ntitle: 孤立\n---\n本文\n")
        orphans = [f for f in knowledge.audit(self.root)["findings"]
                   if f["check"] == "orphan"]
        self.assertTrue(orphans)
        self.assertEqual(orphans[0]["severity"], "info")

    def test_clean_vault_reports_no_findings(self):
        self.write("sources/x.md",
                   "---\ntitle: 出典\nsource: https://ex.jp\nfetched_at: 2026-08-01\n---\n本文\n")
        self.write("notes/a.md",
                   "---\ntitle: 主張\nsource: ../sources/x.md\nupdated: 2026-08-01\n---\n"
                   "[出典](../sources/x.md) [自己](../notes/a.md) [元](../sources/x.md)\n")
        data = knowledge.audit(self.root)
        self.assertEqual(data["counts"].get("error", 0), 0)

    def test_render_audit_is_readable(self):
        self.write("notes/a.md", "# 考察\n本文\n")
        text = knowledge.render_audit(knowledge.audit(self.root))
        self.assertIn("knowledge audit", text)
        self.assertIn("missing-source", text)


class TestCli(unittest.TestCase):
    """Exercise the CLI as a subprocess: argument wiring is easy to break."""

    def run_cli(self, *args):
        return subprocess.run(
            [sys.executable, os.path.join(PLUGIN_ROOT, "scripts", "kumiki.py")]
            + list(args),
            capture_output=True, text=True, timeout=120)

    def test_version(self):
        result = self.run_cli("--version")
        self.assertEqual(result.returncode, 0)
        self.assertIn("kumiki", result.stdout)

    def test_help_lists_all_groups(self):
        result = self.run_cli("--help")
        for group in ("gather", "thrift", "knowledge"):
            self.assertIn(group, result.stdout)

    def test_thrift_outline_json(self):
        with tempfile.TemporaryDirectory() as directory:
            path = os.path.join(directory, "d.md")
            with open(path, "w", encoding="utf-8") as handle:
                handle.write("# A\nx\n## B\ny\n")
            result = self.run_cli("--json", "thrift", "outline", path)
            self.assertEqual(result.returncode, 0)
            data = json.loads(result.stdout)
            self.assertEqual([s["title"] for s in data["sections"]], ["A", "B"])

    def test_gather_select_on_local_file(self):
        with tempfile.TemporaryDirectory() as directory:
            path = os.path.join(directory, "p.html")
            with open(path, "w", encoding="utf-8") as handle:
                handle.write('<div><h1>抹茶</h1><span class="price">1,280円</span></div>')
            result = self.run_cli("gather", "select", path,
                                  "--field", "name=h1",
                                  "--field", "price=.price", "--format", "json")
            self.assertEqual(result.returncode, 0)
            record = json.loads(result.stdout)[0]
            self.assertEqual(record["name"], "抹茶")
            self.assertEqual(record["price"], "1,280円")

    def test_knowledge_audit_strict_exits_three_on_error(self):
        with tempfile.TemporaryDirectory() as directory:
            self.run_cli("knowledge", "init", directory)
            os.makedirs(os.path.join(directory, "notes"), exist_ok=True)
            with open(os.path.join(directory, "notes", "a.md"), "w",
                      encoding="utf-8") as handle:
                handle.write("# T\n[x](../sources/missing.md)\n")
            result = self.run_cli("knowledge", "audit", directory, "--strict")
            self.assertEqual(result.returncode, 3)

    def test_slice_missing_section_exits_nonzero(self):
        with tempfile.TemporaryDirectory() as directory:
            path = os.path.join(directory, "d.md")
            with open(path, "w", encoding="utf-8") as handle:
                handle.write("# A\nx\n")
            result = self.run_cli("thrift", "slice", path, "nope")
            self.assertEqual(result.returncode, 1)


class TestHooks(unittest.TestCase):
    def run_hook(self, script, payload, env=None):
        environment = dict(os.environ)
        environment.update(env or {})
        return subprocess.run(
            [sys.executable, os.path.join(PLUGIN_ROOT, "scripts", "hooks", script)],
            input=json.dumps(payload), capture_output=True, text=True,
            env=environment, timeout=60)

    def test_read_guard_allows_small_files(self):
        with tempfile.TemporaryDirectory() as directory:
            path = os.path.join(directory, "s.md")
            with open(path, "w", encoding="utf-8") as handle:
                handle.write("# small\n")
            result = self.run_hook("read_guard.py", {
                "session_id": "s1", "tool_name": "Read",
                "tool_input": {"file_path": path}},
                {"CLAUDE_PLUGIN_DATA": directory})
            self.assertEqual(result.returncode, 0)
            self.assertEqual(result.stdout.strip(), "")

    def test_read_guard_denies_once_then_allows(self):
        with tempfile.TemporaryDirectory() as directory:
            path = os.path.join(directory, "big.md")
            with open(path, "w", encoding="utf-8") as handle:
                handle.write("".join(
                    "## 章{}\n{}\n".format(i, "本文。" * 200) for i in range(30)))
            environment = {"CLAUDE_PLUGIN_DATA": directory,
                           "KUMIKI_READ_GUARD_TOKENS": "1000"}
            payload = {"session_id": "s2", "tool_name": "Read",
                       "tool_input": {"file_path": path}}

            first = self.run_hook("read_guard.py", payload, environment)
            self.assertEqual(first.returncode, 0)
            decision = json.loads(first.stdout)["hookSpecificOutput"]
            self.assertEqual(decision["permissionDecision"], "deny")
            self.assertIn("章0", decision["permissionDecisionReason"])

            second = self.run_hook("read_guard.py", payload, environment)
            self.assertEqual(second.stdout.strip(), "")

    def test_read_guard_ignores_targeted_reads(self):
        with tempfile.TemporaryDirectory() as directory:
            path = os.path.join(directory, "big.md")
            with open(path, "w", encoding="utf-8") as handle:
                handle.write("## a\n" + "本文。" * 5000)
            result = self.run_hook("read_guard.py", {
                "session_id": "s3", "tool_name": "Read",
                "tool_input": {"file_path": path, "limit": 50}},
                {"CLAUDE_PLUGIN_DATA": directory, "KUMIKI_READ_GUARD_TOKENS": "10"})
            self.assertEqual(result.stdout.strip(), "")

    def test_read_guard_off_switch(self):
        with tempfile.TemporaryDirectory() as directory:
            path = os.path.join(directory, "big.md")
            with open(path, "w", encoding="utf-8") as handle:
                handle.write("## a\n" + "本文。" * 5000)
            result = self.run_hook("read_guard.py", {
                "session_id": "s4", "tool_name": "Read",
                "tool_input": {"file_path": path}},
                {"CLAUDE_PLUGIN_DATA": directory, "KUMIKI_READ_GUARD": "off",
                 "KUMIKI_READ_GUARD_TOKENS": "10"})
            self.assertEqual(result.stdout.strip(), "")

    def test_read_guard_fails_open_on_garbage_input(self):
        result = subprocess.run(
            [sys.executable, os.path.join(PLUGIN_ROOT, "scripts", "hooks",
                                          "read_guard.py")],
            input="not json at all", capture_output=True, text=True, timeout=60)
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout.strip(), "")

    def test_read_guard_ignores_other_tools(self):
        result = self.run_hook("read_guard.py", {
            "session_id": "s5", "tool_name": "Bash",
            "tool_input": {"command": "ls"}})
        self.assertEqual(result.stdout.strip(), "")

    def test_ledger_appends_one_line_per_fetch(self):
        with tempfile.TemporaryDirectory() as directory:
            for url in ("https://ex.jp/a", "https://ex.jp/b"):
                result = self.run_hook("source_ledger.py", {
                    "session_id": "s6", "tool_name": "WebFetch",
                    "tool_input": {"url": url, "prompt": "p"}, "cwd": "/w"},
                    {"CLAUDE_PLUGIN_DATA": directory})
                self.assertEqual(result.returncode, 0)
            ledger = os.path.join(directory, "ledger")
            files = os.listdir(ledger)
            self.assertEqual(len(files), 1)
            with open(os.path.join(ledger, files[0]), encoding="utf-8") as handle:
                entries = [json.loads(line) for line in handle if line.strip()]
            self.assertEqual([e["url"] for e in entries],
                             ["https://ex.jp/a", "https://ex.jp/b"])

    def test_ledger_ignores_unrelated_tools(self):
        with tempfile.TemporaryDirectory() as directory:
            self.run_hook("source_ledger.py", {
                "session_id": "s7", "tool_name": "Read",
                "tool_input": {"file_path": "x"}},
                {"CLAUDE_PLUGIN_DATA": directory})
            self.assertFalse(os.path.isdir(os.path.join(directory, "ledger")))

    def test_ledger_off_switch(self):
        with tempfile.TemporaryDirectory() as directory:
            self.run_hook("source_ledger.py", {
                "session_id": "s8", "tool_name": "WebFetch",
                "tool_input": {"url": "https://ex.jp/a"}},
                {"CLAUDE_PLUGIN_DATA": directory, "KUMIKI_LEDGER": "off"})
            self.assertFalse(os.path.isdir(os.path.join(directory, "ledger")))


if __name__ == "__main__":
    unittest.main(verbosity=2)
