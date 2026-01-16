# Ship Command - Code Review, Commit & Push

Führe eine Qualitätsprüfung der uncommitted Änderungen durch, behebe Probleme und committe/pushe wenn alles in Ordnung ist.

## Workflow

### 1. Änderungen analysieren

Schaue dir alle uncommitted Änderungen an:
- `git status` für eine Übersicht
- `git diff` für die konkreten Änderungen (staged und unstaged)

### 2. Qualitätsprüfung

Prüfe die Änderungen auf:

**Code-Qualität:**
- TypeScript-Fehler (führe `npm run typecheck` aus)
- Lint-Fehler (führe `npm run lint` aus)
- Offensichtliche Bugs oder Probleme
- Sicherheitslücken (keine Secrets, keine Injection-Vulnerabilities)

**Best Practices:**
- Keine auskommentierten Code-Blöcke committed
- Keine Debug-Logs (`console.log` etc.) die nicht da sein sollten
- Keine TODO-Kommentare die noch erledigt werden müssten
- Code folgt den Projekt-Konventionen aus CLAUDE.md

### 3. Probleme beheben

Falls Probleme gefunden werden:
- Behebe automatisch fixbare Probleme (z.B. Lint-Fehler mit `npm run lint -- --fix`)
- Für andere Probleme: Erkläre was gefunden wurde und schlage Fixes vor
- Nach dem Fix, führe die Checks erneut aus

### 4. Commit & Push

Wenn alle Checks bestanden sind:

1. Stage alle relevanten Änderungen (`git add`)
2. Erstelle einen aussagekräftigen Commit mit Conventional Commits Format:
   - `feat:` für neue Features
   - `fix:` für Bugfixes
   - `refactor:` für Refactoring
   - `docs:` für Dokumentation
   - `chore:` für Maintenance
   - `perf:` für Performance-Verbesserungen
3. Pushe zum Remote

**Wichtig:**
- Frage NICHT nach Bestätigung bevor du pushst - führe den kompletten Workflow aus
- Committe keine `.env` Dateien oder andere Secrets
- Der Commit-Message soll prägnant beschreiben WAS und WARUM geändert wurde
