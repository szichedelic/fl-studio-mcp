"""
FL Bridge Handlers Package

This module imports all handler modules to trigger their registration
when the handlers package is imported.

USAGE:
======
In device_FLBridge.py OnInit():
    from handlers import transport, state, patterns

This import causes all handlers to register themselves with the
command routing system.

AUTHOR: FL Studio MCP Project
"""

# Import handler modules to trigger registration
# Each module registers its handlers via register_handler() on import
from handlers import transport
from handlers import state
from handlers import patterns
from handlers import pianoroll
from handlers import mixer
from handlers import playlist
from handlers import project
