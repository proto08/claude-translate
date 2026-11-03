"""Local translation server: Firefox extension -> `claude -p` (uses your Claude Code login).

Least-privilege design:
  * listens on 127.0.0.1 only
  * requires a random bearer token (created on first run, file mode 0600)
  * rejects any Origin that is not a moz-extension:// page, and any foreign Host header
  * claude runs with NO tools, NO MCP servers, NO slash commands/skills,
    in an empty temp dir, with a minimal environment
  * request size / batch size are capped
Stdlib only.

Modules:
  config      limits and token file handling
  sanitize    input sanitizing, output validation, strict JSON parsing (prompt-injection defence)
  claude      the `claude -p` subprocess call and prompt
  translator  cache + validation + retry policy on top of `claude`
  handler     HTTP layer (Host/Origin/token guard, request validation)
  cli         argument parsing and server startup
"""
