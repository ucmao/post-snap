# Platform fixtures

Each `<id>.json` holds every HTTP response recorded while extracting one article from
`test/platforms.json`, plus the expected extraction summary. `npm test` replays them
offline through the full pipeline, so extractor regressions show up without hitting
the network (and without flaky failures when a platform blocks or deletes an article).

```bash
npm run fixtures:record               # re-record all platforms (needs network)
npm run fixtures:record -- wechat 36kr  # re-record specific ids
```

A platform that fails while recording keeps its previous fixture. When a platform
redesign breaks an extractor: fix the extractor, re-record that id, review the diff.
