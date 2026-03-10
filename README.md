# ⚖️ Fintech Poland — Monitor Legislacyjny

Dashboard do monitorowania regulacji finansowych PL i EU, zasilany AI.

## 🚀 Wdrożenie na Vercel (10 minut)

### Krok 1 — Wrzuć projekt na GitHub

1. Wejdź na **github.com** i zaloguj się
2. Kliknij zielony przycisk **"New"** (nowe repozytorium)
3. Nazwa: `fintech-monitor`
4. Zostaw ustawienia domyślne → kliknij **"Create repository"**
5. Na stronie repozytorium kliknij **"uploading an existing file"**
6. Przeciągnij i upuść **wszystkie pliki z tego folderu** (zachowując strukturę folderów)
7. Kliknij **"Commit changes"**

### Krok 2 — Wdróż na Vercel

1. Wejdź na **vercel.com** i zaloguj się przez GitHub
2. Kliknij **"Add New Project"**
3. Znajdź `fintech-monitor` → kliknij **"Import"**
4. W sekcji **"Environment Variables"** dodaj:
   - Name: `REACT_APP_ANTHROPIC_API_KEY`
   - Value: Twój klucz API z console.anthropic.com
5. Kliknij **"Deploy"**
6. Po 2-3 minutach dostaniesz link: `fintech-monitor.vercel.app`

### Jak zdobyć klucz API Anthropic

1. Wejdź na **console.anthropic.com**
2. Zarejestruj się (darmowe konto)
3. Idź do **"API Keys"** → kliknij **"Create Key"**
4. Skopiuj klucz (zaczyna się od `sk-ant-...`)

## 📋 Funkcje

- 🔍 **AI Search** — wyszukuje aktualne regulacje w czasie rzeczywistym
- ⚖️ **Pipeline PL** — Konsultacje → Sejm I → Komisja → Senat → Dz.U.
- 🇪🇺 **Pipeline EU** — KE → Parlament → Trilog → Transpozycja → Obowiązuje
- 🔔 **Alerty** — powiadomienia o zmianach etapów
- 📝 **Notatki** — notatki zespołu przy każdym projekcie
- ⊞ **Kanban** — widok tablicy z projektami w kolumnach etapów
- ↓ **PDF Export** — raport do druku
