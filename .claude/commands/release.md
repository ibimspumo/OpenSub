# Release Command - Version Bump, Changelog & Publish

Erstelle eine neue Version mit automatischem Changelog, aktualisiere alle Dateien und pushe einen Tag um die GitHub Action auszulösen.

## Argumente

Das erste Argument bestimmt den Version-Bump:
- `patch` (default) - Bug fixes (0.3.0 → 0.3.1)
- `minor` - Neue Features (0.3.0 → 0.4.0)
- `major` - Breaking Changes (0.3.0 → 1.0.0)

Beispiel: `/release minor`

## Workflow

### 1. Aktuellen Stand prüfen

**Git-Status analysieren:**
- `git status` - Uncommitted changes prüfen
- `git fetch --tags` - Alle Tags holen
- `git describe --tags --abbrev=0` - Letzter Version-Tag (z.B. v0.3.0)
- Aktuelle Version aus `package.json` lesen

**Falls uncommitted changes existieren:**
- Führe erst `/ship` Logik aus (Qualitätsprüfung, Commit)
- Dann weiter mit Release

### 2. Änderungen seit letzter Version analysieren

Sammle alle Commits seit dem letzten Tag:
```bash
git log <letzter-tag>..HEAD --oneline --no-merges
```

Kategorisiere die Commits nach Conventional Commits:
- `feat:` → Features
- `fix:` → Bug Fixes
- `refactor:` → Refactoring
- `perf:` → Performance
- `docs:` → Documentation
- `chore:` → Maintenance

### 3. Neue Version berechnen

Basierend auf dem Argument (patch/minor/major):
- Parse aktuelle Version aus `package.json`
- Berechne neue Version nach Semver

### 4. Dateien aktualisieren

Aktualisiere die Version in allen relevanten Dateien:

**package.json:**
```json
"version": "X.Y.Z"
```

**README.md:**
```markdown
![Version](https://img.shields.io/badge/Version-X.Y.Z-orange)
```

**package-lock.json:**
Wird automatisch durch `npm install --package-lock-only` aktualisiert.

### 5. Release Commit erstellen

Erstelle einen Commit mit Release Notes im Body:

```
chore: Release vX.Y.Z

## What's Changed

### Features
- feat: Beschreibung (Commit-Hash)

### Bug Fixes
- fix: Beschreibung (Commit-Hash)

### Other Changes
- refactor: Beschreibung (Commit-Hash)

**Full Changelog**: https://github.com/ibimspumo/OpenSub/compare/vOLD...vNEW

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

### 6. Tag erstellen und pushen

```bash
# Tag erstellen
git tag -a vX.Y.Z -m "Release vX.Y.Z"

# Commit und Tag pushen
git push origin main
git push origin vX.Y.Z
```

Der Tag-Push löst automatisch die GitHub Action `.github/workflows/build.yml` aus, die:
1. Die macOS App baut
2. Ein GitHub Release erstellt
3. Die DMG-Datei als Asset hochlädt

### 7. Abschluss

Zeige dem User:
- Die neue Version
- Link zum GitHub Release (sobald Action läuft)
- Zusammenfassung der Änderungen

## Wichtige Hinweise

- Prüfe IMMER ob alle Tests/Checks bestehen bevor du releast
- Der Tag MUSS mit `v` beginnen (z.B. `v0.4.0`) damit die GitHub Action triggert
- Committe KEINE Secrets oder `.env` Dateien
- Bei Fehlern während des Releases: Tag löschen mit `git tag -d vX.Y.Z && git push origin :refs/tags/vX.Y.Z`
