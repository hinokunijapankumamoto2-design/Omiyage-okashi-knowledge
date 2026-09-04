"""A forgiving DOM-lite parser and CSS-subset selector engine.

Built on :mod:`html.parser` so it needs no third-party dependency. It is not a
spec-compliant HTML5 tree builder; it is a pragmatic parser that survives the
malformed markup real sites ship, plus enough selector support to pull the
fields you actually want out of a page.

Supported selector syntax
    tag  .class  #id  [attr]  [attr=value]  [attr^=v]  [attr$=v]  [attr*=v]
    descendant (space)   child (>)   selector groups (,)   universal (*)

Not supported (deliberately): pseudo-classes, sibling combinators, :nth-child.
Those add parser weight for cases a `select()` plus a Python filter handles.
"""

from __future__ import annotations

import re
from html.parser import HTMLParser
from typing import Dict, Iterator, List, Optional, Sequence, Tuple

VOID_ELEMENTS = frozenset(
    "area base br col embed hr img input link meta param source track wbr".split()
)

# Tags that an opening tag implicitly closes, keyed by the tag being opened.
_IMPLIED_CLOSE: Dict[str, frozenset] = {
    "li": frozenset({"li"}),
    "dt": frozenset({"dt", "dd"}),
    "dd": frozenset({"dt", "dd"}),
    "tr": frozenset({"tr", "td", "th"}),
    "td": frozenset({"td", "th"}),
    "th": frozenset({"td", "th"}),
    "option": frozenset({"option"}),
    "thead": frozenset({"tr", "td", "th"}),
    "tbody": frozenset({"tr", "td", "th", "thead"}),
    "tfoot": frozenset({"tr", "td", "th", "tbody"}),
}

_BLOCK_CLOSING_P = frozenset(
    """address article aside blockquote details div dl fieldset figcaption figure
    footer form h1 h2 h3 h4 h5 h6 header hr main nav ol p pre section table ul""".split()
)


class Node:
    """An element or a text node.

    Text nodes carry ``tag is None`` and a non-empty ``text``.
    """

    __slots__ = ("tag", "attrs", "children", "parent", "text")

    def __init__(self, tag: Optional[str], attrs: Optional[Dict[str, str]] = None,
                 text: str = "", parent: Optional["Node"] = None) -> None:
        self.tag = tag
        self.attrs: Dict[str, str] = attrs or {}
        self.children: List["Node"] = []
        self.parent = parent
        self.text = text

    # -- tree helpers ---------------------------------------------------
    @property
    def is_text(self) -> bool:
        return self.tag is None

    def get(self, name: str, default: str = "") -> str:
        return self.attrs.get(name, default)

    @property
    def classes(self) -> List[str]:
        return self.get("class", "").split()

    def walk(self) -> Iterator["Node"]:
        """Yield this node then every descendant, depth first."""
        yield self
        for child in self.children:
            for node in child.walk():
                yield node

    def elements(self) -> Iterator["Node"]:
        for node in self.walk():
            if not node.is_text:
                yield node

    def text_content(self, separator: str = "") -> str:
        """Concatenate all descendant text."""
        chunks: List[str] = []
        for node in self.walk():
            if node.is_text:
                chunks.append(node.text)
        return separator.join(chunks)

    def find(self, tag: str) -> Optional["Node"]:
        for node in self.elements():
            if node.tag == tag:
                return node
        return None

    def find_all(self, tag: str) -> List["Node"]:
        return [n for n in self.elements() if n.tag == tag]

    def select(self, selector: str) -> List["Node"]:
        return select(self, selector)

    def select_one(self, selector: str) -> Optional["Node"]:
        found = select(self, selector)
        return found[0] if found else None

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        if self.is_text:
            return "Text({!r})".format(self.text[:24])
        return "<{}{}>".format(self.tag, "".join(
            ' {}="{}"'.format(k, v) for k, v in list(self.attrs.items())[:3]))


class _TreeBuilder(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.root = Node("[document]")
        self._stack: List[Node] = [self.root]

    # -- stack management ----------------------------------------------
    def _current(self) -> Node:
        return self._stack[-1]

    def _close_through(self, tags: Sequence[str]) -> None:
        """Pop while the open element is one of ``tags`` (never past root)."""
        while len(self._stack) > 1 and self._current().tag in tags:
            self._stack.pop()

    def handle_starttag(self, tag: str, attrs) -> None:  # type: ignore[override]
        tag = tag.lower()
        if tag == "p" or tag in _BLOCK_CLOSING_P:
            self._close_through(("p",))
        implied = _IMPLIED_CLOSE.get(tag)
        if implied:
            self._close_through(tuple(implied))
        node = Node(tag, {k.lower(): (v if v is not None else "") for k, v in attrs},
                    parent=self._current())
        self._current().children.append(node)
        if tag not in VOID_ELEMENTS:
            self._stack.append(node)

    def handle_startendtag(self, tag: str, attrs) -> None:  # type: ignore[override]
        tag = tag.lower()
        node = Node(tag, {k.lower(): (v if v is not None else "") for k, v in attrs},
                    parent=self._current())
        self._current().children.append(node)

    def handle_endtag(self, tag: str) -> None:  # type: ignore[override]
        tag = tag.lower()
        if tag in VOID_ELEMENTS:
            return
        for depth in range(len(self._stack) - 1, 0, -1):
            if self._stack[depth].tag == tag:
                del self._stack[depth:]
                return
        # Stray close tag with no matching open tag: ignore it.

    def handle_data(self, data: str) -> None:  # type: ignore[override]
        if not data:
            return
        parent = self._current()
        parent.children.append(Node(None, text=data, parent=parent))


def parse(html: str) -> Node:
    """Parse ``html`` into a :class:`Node` tree rooted at ``[document]``."""
    builder = _TreeBuilder()
    try:
        builder.feed(html)
        builder.close()
    except Exception:
        # html.parser can raise on pathological input; return whatever we built.
        pass
    return builder.root


# ---------------------------------------------------------------------------
# Selector engine
# ---------------------------------------------------------------------------

_COMPOUND_RE = re.compile(
    r"""
    (?P<tag>^[A-Za-z][-\w]*|\*)?
    (?P<rest>(?:
        \#[-\w]+
      | \.[-\w]+
      | \[\s*[-\w:]+\s*(?:[\^$*|~]?=\s*(?:"[^"]*"|'[^']*'|[^\]]*))?\s*\]
    )*)
    """,
    re.VERBOSE,
)

_PART_RE = re.compile(
    r"""
      \#(?P<id>[-\w]+)
    | \.(?P<cls>[-\w]+)
    | \[\s*(?P<attr>[-\w:]+)\s*
        (?:(?P<op>[\^$*|~]?=)\s*(?:"(?P<dq>[^"]*)"|'(?P<sq>[^']*)'|(?P<bare>[^\]]*?))\s*)?
      \]
    """,
    re.VERBOSE,
)


class _Compound:
    __slots__ = ("tag", "id", "classes", "attrs")

    def __init__(self) -> None:
        self.tag: Optional[str] = None
        self.id: Optional[str] = None
        self.classes: List[str] = []
        self.attrs: List[Tuple[str, Optional[str], Optional[str]]] = []

    def matches(self, node: Node) -> bool:
        if node.is_text:
            return False
        if self.tag and self.tag != "*" and node.tag != self.tag:
            return False
        if self.id is not None and node.get("id") != self.id:
            return False
        if self.classes:
            have = set(node.classes)
            if not have.issuperset(self.classes):
                return False
        for name, op, value in self.attrs:
            if name not in node.attrs:
                return False
            if op is None:
                continue
            actual = node.attrs[name]
            expected = value or ""
            if op == "=" and actual != expected:
                return False
            if op == "^=" and not actual.startswith(expected):
                return False
            if op == "$=" and not actual.endswith(expected):
                return False
            if op == "*=" and expected not in actual:
                return False
            if op == "~=" and expected not in actual.split():
                return False
            if op == "|=" and not (actual == expected or actual.startswith(expected + "-")):
                return False
        return True


def _parse_compound(text: str) -> _Compound:
    compound = _Compound()
    match = _COMPOUND_RE.match(text)
    if match and match.group("tag"):
        compound.tag = match.group("tag").lower()
    for part in _PART_RE.finditer(text):
        if part.group("id"):
            compound.id = part.group("id")
        elif part.group("cls"):
            compound.classes.append(part.group("cls"))
        elif part.group("attr"):
            value = part.group("dq")
            if value is None:
                value = part.group("sq")
            if value is None:
                value = part.group("bare")
            compound.attrs.append((part.group("attr").lower(), part.group("op"),
                                   value.strip() if value else value))
    return compound


def _parse_sequence(selector: str) -> List[Tuple[str, _Compound]]:
    """Return ``[(combinator, compound), ...]`` left to right.

    The first entry always carries the combinator ``" "`` (descendant of root).
    """
    tokens = re.split(r"\s*(>)\s*|\s+", selector.strip())
    tokens = [t for t in tokens if t]
    sequence: List[Tuple[str, _Compound]] = []
    combinator = " "
    for token in tokens:
        if token == ">":
            combinator = ">"
            continue
        sequence.append((combinator, _parse_compound(token)))
        combinator = " "
    return sequence


def _matches_sequence(node: Node, sequence: List[Tuple[str, _Compound]]) -> bool:
    index = len(sequence) - 1
    combinator, compound = sequence[index]
    if not compound.matches(node):
        return False
    current = node.parent
    index -= 1
    while index >= 0:
        combinator, compound = sequence[index + 1][0], sequence[index][1]
        if combinator == ">":
            if current is None or not compound.matches(current):
                return False
            current = current.parent
        else:
            while current is not None and not compound.matches(current):
                current = current.parent
            if current is None:
                return False
            current = current.parent
        index -= 1
    return True


def select(root: Node, selector: str) -> List[Node]:
    """Return every element under ``root`` matching ``selector``.

    Groups separated by ``,`` are unioned, preserving document order and
    removing duplicates.
    """
    groups = [g for g in (s.strip() for s in selector.split(",")) if g]
    sequences = [_parse_sequence(g) for g in groups if g]
    sequences = [s for s in sequences if s]
    if not sequences:
        return []
    seen: set = set()
    result: List[Node] = []
    for node in root.elements():
        if node is root:
            continue
        for sequence in sequences:
            if _matches_sequence(node, sequence):
                if id(node) not in seen:
                    seen.add(id(node))
                    result.append(node)
                break
    return result
