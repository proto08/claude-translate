// Local translation server: Chromium extension -> `claude -p` (uses your Claude Code login).
//
// Least-privilege design:
//   - listens on 127.0.0.1 only
//   - requires a random bearer token (created on first run, file mode 0600)
//   - rejects any Origin that is not a chrome-extension:// page, and any foreign Host header
//   - claude runs with NO tools, NO MCP servers, NO slash commands/skills,
//     in an empty temp dir, with a minimal environment
//   - request size / batch size are capped
//
// Standard library only.
//
// Files:
//
//	config      limits and token file handling
//	sanitize    input sanitizing, output validation, strict JSON parsing (prompt-injection defence)
//	claude      the `claude -p` subprocess call and prompt
//	translator  cache + validation + retry policy on top of claude
//	handler     HTTP layer (Host/Origin/token guard, request validation)
//	main        argument parsing and server startup
package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"time"
)

func main() {
	port := flag.Int("port", defaultPort, "listen port")
	model := flag.String("model", defaultModel, "claude model alias or id")
	showToken := flag.Bool("show-token", false, "print token and exit")
	flag.Parse()

	tok, err := loadToken()
	if err != nil {
		log.Fatal(err)
	}
	if *showToken {
		fmt.Println(tok)
		return
	}
	tp, _ := tokenPath()
	fmt.Printf("listening on http://127.0.0.1:%d  model=%s\n", *port, *model)
	fmt.Printf("token file: %s  (claude-translate --show-token)\n", tp)
	srv := &http.Server{
		Addr:              "127.0.0.1:" + strconv.Itoa(*port),
		Handler:           &handler{token: tok, port: *port, model: *model},
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		// Must outlast claudeTimeout (a retry-by-halves can take several rounds).
		WriteTimeout: 10 * time.Minute,
	}
	if err := srv.ListenAndServe(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
