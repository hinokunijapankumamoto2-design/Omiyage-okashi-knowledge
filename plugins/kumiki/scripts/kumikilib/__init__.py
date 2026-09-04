"""kumikilib — dependency-free building blocks for the Kumiki plugin.

All modules in this package use the Python 3.8+ standard library only.
No pip install, no external API keys, no network calls outside `fetcher`.
"""

__version__ = "0.1.0"

__all__ = [
    "tokens",
    "htmldom",
    "extract",
    "cache",
    "fetcher",
    "gather",
    "thrift",
    "knowledge",
]
