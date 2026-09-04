#!/usr/bin/env python3
"""Kumiki CLI — gather, thrift, knowledge.

    python3 kumiki.py gather fetch https://example.com --out sources/
    python3 kumiki.py thrift plan ./docs --budget 20000
    python3 kumiki.py knowledge audit ./vault

Standard library only. No API keys, no pip install, no network access except
the URLs you name in a `gather` command.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from typing import Any, Dict, List, Optional, Sequence

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from kumikilib import __version__, extract, gather, knowledge, thrift, tokens  # noqa: E402
from kumikilib.cache import Cache  # noqa: E402
from kumikilib.fetcher import DEFAULT_DELAY, DEFAULT_USER_AGENT, FetchError, Fetcher  # noqa: E402

EXIT_OK = 0
EXIT_USAGE = 2
EXIT_FAILED = 1
EXIT_AUDIT_ERRORS = 3


def default_cache_dir() -> str:
    plugin_data = os.environ.get("CLAUDE_PLUGIN_DATA")
    if plugin_data:
        return os.path.join(plugin_data, "http-cache")
    base = os.environ.get("XDG_CACHE_HOME") or os.path.join(
        os.path.expanduser("~"), ".cache")
    return os.path.join(base, "kumiki", "http-cache")


def emit(data: Any, as_json: bool, text: str) -> None:
    if as_json:
        print(json.dumps(data, ensure_ascii=False, indent=2))
    else:
        print(text)


def make_fetcher(args: argparse.Namespace) -> Fetcher:
    cache = Cache(args.cache_dir, ttl=args.cache_ttl * 3600,
                  enabled=not args.no_cache)
    return Fetcher(
        user_agent=args.user_agent,
        delay=args.delay,
        timeout=args.timeout,
        respect_robots=not args.ignore_robots,
        cache=cache,
        verbose=not args.quiet,
    )


def logger(args: argparse.Namespace):
    if args.quiet:
        return lambda _message: None
    return lambda message: print(message, file=sys.stderr)


# ---------------------------------------------------------------------------
# gather
# ---------------------------------------------------------------------------

def _report_gather(result: Dict[str, Any], args: argparse.Namespace) -> int:
    documents = result["documents"]
    failures = result["failures"]
    if args.out:
        manifest = gather.write_notes(documents, args.out,
                                      {"failures": failures})
        if args.json:
            print(json.dumps(manifest, ensure_ascii=False, indent=2))
        else:
            print("wrote {} notes to {} ({} tokens total)".format(
                manifest["count"], os.path.abspath(args.out),
                tokens.human(manifest["total_est_tokens"])))
            for entry in manifest["documents"]:
                print("  {}  {} tok  {}".format(
                    entry["file"], tokens.human(entry["est_tokens"]),
                    entry["title"][:60]))
    elif args.json:
        print(json.dumps({
            "documents": [dict(d.as_dict(), body=d.body) for d in documents],
            "failures": failures,
        }, ensure_ascii=False, indent=2))
    else:
        for document in documents:
            print("\n" + "=" * 72)
            print(document.to_markdown())
    if failures:
        for failure in failures:
            print("failed: {} — {}".format(failure["url"], failure["error"]),
                  file=sys.stderr)
    if not documents:
        return EXIT_FAILED
    return EXIT_OK


def cmd_gather_fetch(args: argparse.Namespace) -> int:
    fetcher = make_fetcher(args)
    result = gather.fetch_documents(
        args.urls, fetcher, keep_links=not args.no_links,
        main_only=not args.full_page, on_event=logger(args))
    return _report_gather(result, args)


def cmd_gather_crawl(args: argparse.Namespace) -> int:
    fetcher = make_fetcher(args)
    result = gather.crawl(
        args.seed, fetcher, depth=args.depth, max_pages=args.max_pages,
        same_host=not args.allow_offsite, include=args.include,
        exclude=args.exclude, keep_links=not args.no_links,
        main_only=not args.full_page, on_event=logger(args))
    return _report_gather(result, args)


def cmd_gather_sitemap(args: argparse.Namespace) -> int:
    fetcher = make_fetcher(args)
    urls = gather.read_sitemap(args.url, fetcher, limit=args.limit,
                               on_event=logger(args))
    if args.match:
        import re
        pattern = re.compile(args.match)
        urls = [u for u in urls if pattern.search(u)]
    if not args.fetch:
        emit({"count": len(urls), "urls": urls}, args.json, "\n".join(urls))
        return EXIT_OK if urls else EXIT_FAILED
    result = gather.fetch_documents(
        urls[:args.max_pages], fetcher, keep_links=not args.no_links,
        main_only=not args.full_page, on_event=logger(args))
    return _report_gather(result, args)


def cmd_gather_select(args: argparse.Namespace) -> int:
    selectors: Dict[str, str] = {}
    for pair in args.field:
        name, separator, selector = pair.partition("=")
        if not separator:
            print("--field expects name=selector, got: {}".format(pair),
                  file=sys.stderr)
            return EXIT_USAGE
        selectors[name.strip()] = selector.strip()

    records: List[Dict[str, Any]] = []
    fetcher: Optional[Fetcher] = None
    for target in args.targets:
        if target.startswith(("http://", "https://")):
            fetcher = fetcher or make_fetcher(args)
            try:
                response = fetcher.fetch(target)
            except FetchError as error:
                print("failed: {} — {}".format(target, error), file=sys.stderr)
                continue
            html, source = response.body, response.final_url
        else:
            try:
                html = thrift.read_text(target)
            except OSError as error:
                print("failed: {} — {}".format(target, error), file=sys.stderr)
                continue
            source = os.path.abspath(target)
        records.append(gather.select_fields(html, source, selectors))

    if not records:
        return EXIT_FAILED
    if args.format == "json" or args.json:
        print(json.dumps(records, ensure_ascii=False, indent=2))
    elif args.format == "csv":
        import csv
        columns = ["_url"] + [c for c in selectors]
        writer = csv.DictWriter(sys.stdout, fieldnames=columns,
                                extrasaction="ignore")
        writer.writeheader()
        for record in records:
            writer.writerow({k: (" | ".join(v) if isinstance(v, list) else v)
                             for k, v in record.items()})
    else:
        for record in records:
            print("\n# {}".format(record.get("_url", "")))
            for key, value in record.items():
                if key == "_url":
                    continue
                print("  {}: {}".format(key, value))
    return EXIT_OK


def cmd_gather_cache(args: argparse.Namespace) -> int:
    cache = Cache(args.cache_dir, ttl=args.cache_ttl * 3600)
    if args.purge_all:
        removed = cache.purge(older_than=0)
    else:
        removed = cache.purge(older_than=args.older_than * 3600
                              if args.older_than is not None else None)
    print("purged {} cache entries from {}".format(removed, cache.directory))
    return EXIT_OK


# ---------------------------------------------------------------------------
# thrift
# ---------------------------------------------------------------------------

def cmd_thrift_budget(args: argparse.Namespace) -> int:
    data = thrift.budget(args.paths, args.include, args.exclude)
    lines = ["{} files · {} estimated tokens".format(
        data["files"], data["total_human"]), ""]
    lines.append("| tokens | verdict | file |")
    lines.append("| --- | --- | --- |")
    for entry in data["entries"][:args.top]:
        lines.append("| {} | {} | `{}` |".format(
            tokens.human(entry["est_tokens"]), entry["verdict"], entry["path"]))
    if data["files"] > args.top:
        lines.append("| … | | and {} more files |".format(data["files"] - args.top))
    emit(data, args.json, "\n".join(lines))
    return EXIT_OK


def cmd_thrift_outline(args: argparse.Namespace) -> int:
    try:
        data = thrift.outline(args.file, max_depth=args.depth)
    except OSError as error:
        print("cannot read {}: {}".format(args.file, error), file=sys.stderr)
        return EXIT_FAILED
    emit(data, args.json, thrift.render_outline(data))
    return EXIT_OK


def cmd_thrift_slice(args: argparse.Namespace) -> int:
    try:
        data = thrift.slice_section(args.file, args.section,
                                    include_subsections=not args.no_subsections)
    except OSError as error:
        print("cannot read {}: {}".format(args.file, error), file=sys.stderr)
        return EXIT_FAILED
    if data is None:
        print("no section matching {!r} in {}".format(args.section, args.file),
              file=sys.stderr)
        print("run `thrift outline` to see what is there.", file=sys.stderr)
        return EXIT_FAILED
    if args.json:
        print(json.dumps(data, ensure_ascii=False, indent=2))
    else:
        print("<!-- {} L{}-{} · {} of {} tokens -->".format(
            data["path"], data["start_line"], data["end_line"],
            tokens.human(data["est_tokens"]),
            tokens.human(data["whole_file_est_tokens"])))
        print(data["text"])
    return EXIT_OK


def cmd_thrift_index(args: argparse.Namespace) -> int:
    data = thrift.build_index(args.directory, args.include, args.exclude,
                              headings_per_file=args.headings)
    text = thrift.render_index(data)
    if args.out:
        out_path = os.path.abspath(os.path.expanduser(args.out))
        os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)
        with open(out_path, "w", encoding="utf-8") as handle:
            handle.write(text)
        print("wrote {} ({} files, index costs {} vs corpus {})".format(
            out_path, data["files"], tokens.human(data["index_est_tokens"]),
            tokens.human(data["corpus_est_tokens"])))
    else:
        emit(data, args.json, text)
    return EXIT_OK


def cmd_thrift_plan(args: argparse.Namespace) -> int:
    data = thrift.plan(args.paths, args.budget, args.include, args.exclude)
    emit(data, args.json, thrift.render_plan(data))
    return EXIT_OK


# ---------------------------------------------------------------------------
# knowledge
# ---------------------------------------------------------------------------

def cmd_knowledge_init(args: argparse.Namespace) -> int:
    result = knowledge.init_vault(args.directory, args.name or
                                  os.path.basename(os.path.abspath(args.directory)))
    if result["created"]:
        print("initialised {}:".format(result["root"]))
        for item in result["created"]:
            print("  + {}".format(item))
    else:
        print("{} already looks like a Kumiki knowledge base".format(result["root"]))
    return EXIT_OK


def cmd_knowledge_audit(args: argparse.Namespace) -> int:
    data = knowledge.audit(args.directory, stale_days=args.stale_days,
                           max_note_tokens=args.max_note_tokens)
    emit(data, args.json, knowledge.render_audit(data))
    if data["counts"].get("error", 0) and args.strict:
        return EXIT_AUDIT_ERRORS
    return EXIT_OK


def cmd_selftest(args: argparse.Namespace) -> int:
    import unittest
    root = os.path.dirname(os.path.abspath(__file__))
    tests = os.path.join(os.path.dirname(root), "tests")
    suite = unittest.defaultTestLoader.discover(tests, top_level_dir=tests)
    runner = unittest.TextTestRunner(verbosity=2 if not args.quiet else 1)
    return EXIT_OK if runner.run(suite).wasSuccessful() else EXIT_FAILED


# ---------------------------------------------------------------------------
# parser
# ---------------------------------------------------------------------------

def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="kumiki",
        description="Gather sources, keep them citable, and spend tokens on purpose.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""examples:
  kumiki gather fetch https://example.com/a https://example.com/b --out sources/
  kumiki gather crawl https://example.com/news --depth 2 --max-pages 30 --out sources/
  kumiki gather select https://shop.example/x --field name=h1 --field price=.price --format csv
  kumiki thrift plan ./docs --budget 20000
  kumiki thrift outline big.md && kumiki thrift slice big.md "Pricing"
  kumiki knowledge init ./vault && kumiki knowledge audit ./vault --strict
""")
    parser.add_argument("--version", action="version",
                        version="kumiki {}".format(__version__))
    parser.add_argument("-q", "--quiet", action="store_true",
                        help="suppress progress output on stderr")
    parser.add_argument("--json", action="store_true",
                        help="emit machine-readable JSON instead of text")
    groups = parser.add_subparsers(dest="group", metavar="{gather,thrift,knowledge}")

    def add_net_options(sub: argparse.ArgumentParser) -> None:
        sub.add_argument("--delay", type=float, default=DEFAULT_DELAY,
                         help="minimum seconds between requests to one host "
                              "(default: %(default)s)")
        sub.add_argument("--timeout", type=float, default=20.0)
        sub.add_argument("--user-agent", default=DEFAULT_USER_AGENT)
        sub.add_argument("--ignore-robots", action="store_true",
                         help="skip the robots.txt check; only for hosts you own")
        sub.add_argument("--no-cache", action="store_true")
        sub.add_argument("--cache-dir", default=default_cache_dir())
        sub.add_argument("--cache-ttl", type=int, default=24,
                         help="cache lifetime in hours (default: %(default)s)")

    def add_render_options(sub: argparse.ArgumentParser) -> None:
        sub.add_argument("--out", help="directory to write Markdown notes into")
        sub.add_argument("--full-page", action="store_true",
                         help="keep site chrome instead of extracting the article")
        sub.add_argument("--no-links", action="store_true",
                         help="drop hyperlinks (cheaper, less traceable)")

    # -- gather ---------------------------------------------------------
    gather_parser = groups.add_parser(
        "gather", help="collect web sources into citable Markdown")
    gather_subs = gather_parser.add_subparsers(dest="command")

    fetch = gather_subs.add_parser("fetch", help="fetch one or more URLs")
    fetch.add_argument("urls", nargs="+")
    add_net_options(fetch)
    add_render_options(fetch)
    fetch.set_defaults(func=cmd_gather_fetch)

    crawl = gather_subs.add_parser("crawl", help="breadth-first crawl from a seed URL")
    crawl.add_argument("seed")
    crawl.add_argument("--depth", type=int, default=1)
    crawl.add_argument("--max-pages", type=int, default=25)
    crawl.add_argument("--include", help="only follow links matching this regex")
    crawl.add_argument("--exclude", help="never follow links matching this regex")
    crawl.add_argument("--allow-offsite", action="store_true")
    add_net_options(crawl)
    add_render_options(crawl)
    crawl.set_defaults(func=cmd_gather_crawl)

    sitemap = gather_subs.add_parser("sitemap", help="list or fetch a sitemap's URLs")
    sitemap.add_argument("url")
    sitemap.add_argument("--limit", type=int, default=500)
    sitemap.add_argument("--match", help="keep only URLs matching this regex")
    sitemap.add_argument("--fetch", action="store_true",
                         help="also fetch the listed URLs")
    sitemap.add_argument("--max-pages", type=int, default=25)
    add_net_options(sitemap)
    add_render_options(sitemap)
    sitemap.set_defaults(func=cmd_gather_sitemap)

    select = gather_subs.add_parser(
        "select", help="pull named fields out of pages with CSS selectors")
    select.add_argument("targets", nargs="+", help="URLs or local HTML files")
    select.add_argument("--field", action="append", default=[], required=True,
                        metavar="NAME=SELECTOR")
    select.add_argument("--format", choices=["text", "json", "csv"], default="text")
    add_net_options(select)
    select.set_defaults(func=cmd_gather_select)

    cache_cmd = gather_subs.add_parser("cache", help="inspect or purge the HTTP cache")
    cache_cmd.add_argument("--older-than", type=int, metavar="HOURS")
    cache_cmd.add_argument("--purge-all", action="store_true")
    cache_cmd.add_argument("--cache-dir", default=default_cache_dir())
    cache_cmd.add_argument("--cache-ttl", type=int, default=24)
    cache_cmd.set_defaults(func=cmd_gather_cache)

    # -- thrift ---------------------------------------------------------
    thrift_parser = groups.add_parser(
        "thrift", help="know what reading costs before you pay for it")
    thrift_subs = thrift_parser.add_subparsers(dest="command")

    budget_cmd = thrift_subs.add_parser("budget", help="estimate token cost of paths")
    budget_cmd.add_argument("paths", nargs="+")
    budget_cmd.add_argument("--include", action="append")
    budget_cmd.add_argument("--exclude", action="append")
    budget_cmd.add_argument("--top", type=int, default=30)
    budget_cmd.set_defaults(func=cmd_thrift_budget)

    outline_cmd = thrift_subs.add_parser(
        "outline", help="headings or symbols of one file, ~2%% of its cost")
    outline_cmd.add_argument("file")
    outline_cmd.add_argument("--depth", type=int, default=6)
    outline_cmd.set_defaults(func=cmd_thrift_outline)

    slice_cmd = thrift_subs.add_parser("slice", help="print one section by heading")
    slice_cmd.add_argument("file")
    slice_cmd.add_argument("section")
    slice_cmd.add_argument("--no-subsections", action="store_true")
    slice_cmd.set_defaults(func=cmd_thrift_slice)

    index_cmd = thrift_subs.add_parser("index", help="build a compact corpus map")
    index_cmd.add_argument("directory")
    index_cmd.add_argument("--out", help="write Markdown here instead of stdout")
    index_cmd.add_argument("--include", action="append")
    index_cmd.add_argument("--exclude", action="append")
    index_cmd.add_argument("--headings", type=int, default=6)
    index_cmd.set_defaults(func=cmd_thrift_index)

    plan_cmd = thrift_subs.add_parser(
        "plan", help="decide how to read a corpus inside a token budget")
    plan_cmd.add_argument("paths", nargs="+")
    plan_cmd.add_argument("--budget", type=int, required=True)
    plan_cmd.add_argument("--include", action="append")
    plan_cmd.add_argument("--exclude", action="append")
    plan_cmd.set_defaults(func=cmd_thrift_plan)

    # -- knowledge ------------------------------------------------------
    knowledge_parser = groups.add_parser(
        "knowledge", help="structure and audit a knowledge base")
    knowledge_subs = knowledge_parser.add_subparsers(dest="command")

    init_cmd = knowledge_subs.add_parser("init", help="scaffold a knowledge base")
    init_cmd.add_argument("directory")
    init_cmd.add_argument("--name")
    init_cmd.set_defaults(func=cmd_knowledge_init)

    audit_cmd = knowledge_subs.add_parser(
        "audit", help="find unsourced claims, broken links, staleness, orphans")
    audit_cmd.add_argument("directory")
    audit_cmd.add_argument("--stale-days", type=int)
    audit_cmd.add_argument("--max-note-tokens", type=int)
    audit_cmd.add_argument("--strict", action="store_true",
                           help="exit 3 when any error-severity finding exists")
    audit_cmd.set_defaults(func=cmd_knowledge_audit)

    selftest = groups.add_parser("selftest", help="run the bundled test suite")
    selftest.set_defaults(func=cmd_selftest)

    return parser


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    if not getattr(args, "func", None):
        parser.print_help()
        return EXIT_USAGE
    try:
        return args.func(args)
    except KeyboardInterrupt:
        print("\ninterrupted", file=sys.stderr)
        return 130
    except FetchError as error:
        print("fetch failed: {}".format(error), file=sys.stderr)
        return EXIT_FAILED


if __name__ == "__main__":
    sys.exit(main())
