# TODO — zgłoszone przez użytkownika

Kolejność jest zgodna z priorytetami, nie z rozmiarem zmian. Każdy punkt ma
wskazane miejsce w kodzie, żeby dało się go zacząć bez ponownego szukania.
Nic tu nie jest zrobione — to lista, nie opis wdrożenia.

## 1. Nie używaj „boisko / stół", tylko „miejsce”

**Dlaczego:** aplikacja obsługuje korty, stoły, stanowiska, tablice, tory, a
także ping-ponga, bilard, szachy i darts. Wymienianie dwóch rodzajów wyklucza
resztę w oczach użytkownika, zanim w ogóle spróbuje.

**Gdzie:** `src/i18n/pl.ts` — klucze do zmiany na neutralne:

| Linia | Teraz | Proponuję |
|---|---|---|
| 377 | `sch.placesSub`: 'Boiska, stoły, stanowiska, tablice lub tory.' | 'Miejsca, w których rozgrywane są mecze.' |
| 380 | `sch.placePlaceholder`: 'Boisko 1' | 'Miejsce 1' |
| 381–383 | `sch.kindCourt/Table/Station` | etykiety typu zostają, nazwa zbiorcza zmienia się na „miejsce" |
| 388 | `sch.errName`: „Boisko 1" | „Miejsce 1" |
| 404 | `sch.noPlaces`: 'dodaj boisko lub stół' | 'dodaj miejsce' |
| 440 | `codes.tabStationHint` | bez „boiska, stołu lub stanowiska" |
| 449 | `codes.emptyPlacesHint` | jw. |
| 452 | `codes.addPlaces`: 'Dodaj boiska lub stanowiska' | 'Dodaj miejsca' |
| 463 | `codes.note`: 'przy boisku lub stoliku' | 'przy miejscu' |
| 532 | `out.kind.matchesHint`: '… i boiskiem' | '… i miejscem' |
| 534 | `out.kind.scheduleHint`: '… i boisk' | '… i miejsc' |
| 612 | `doc.courtTable`: 'Boisko / stół' | 'Miejsce' |
| 1321 | `sch.errNoPlaces`: 'boisko, stół lub stanowisko' | 'miejsce' |
| 696 | `sch.titleFull`: 'korty, stoły, stanowiska' | bez wyliczania |
| 699 | `sch.noPlacesHint` | jw. |
| 196 | `wizard.venuePlaceholder`: 'Hala sportowa, 4 boiska' | 'Hala sportowa, 4 miejsca' |
| 211 | `overview.shortSchedule`: 'Boiska, stoły, godziny' | 'Miejsca, godziny' |
| 188 | `wizard.expectedHint`: 'boiska i rundy' | 'miejsca i rundy' |

**Uwaga:** klucze `sch.kindCourt` / `kindTable` / `kindStation` opisują *typ*
miejsca i są używane jako wartości w kodzie QR — sama wartość techniczna
(`court`, `table`, `station`) nie wymaga zmiany, tylko etykiety. Zmiana słowa
„Boisko" nie powinna psuć linków do zaplanowanych meczów.

**Do rozważenia:** klucz `sch.titleFull` miesza „korty" i „stoły" po polsku;
„kort" pojawia się tylko w dwóch miejscach i wygląda na prześwit z innej
wersji językowej — prawdopodobnie do poprawy przy okazji.

## 2. „bramki" → „pkt"

**Dlaczego:** „bramki" to piłka nożna. W ping-pongu, darts, bilardzie, szachach
i kręglach ta kolumna nie ma sensu — to po prostu punkty zdobyte.

**Gdzie:** `src/i18n/pl.ts`

| Linia | Teraz | Proponuję |
|---|---|---|
| 817 | `doc.colScored`: 'Bramki' | 'Pkt' |
| 369 | `st.colScored`: 'Bramki strzelone' | 'Punkty zdobyte' |
| 604 | `doc.tiebreak.scored`: 'bramki strzelone' | 'punkty zdobyte' |
| 353 | `st.seedNote` | to samo w zdaniu opisującym losowanie |
| 1052 | `rules.tiebreak.scored` | jw. |

**Rozstrzygnięte 2026-10-01: „Pkt"** — bez kropki, bo kropka odstępuje
w nagłówkach kolumn w PDF-ach.

**Problem kolizji jest realny i trzeba go rozwiązać przy wdrożeniu.**
`doc.colScored` to nagłówek kolumny „punkty zdobyte", a obok stoi
`doc.colPts` = „Pkt" = punkty za zwycięstwo. Po zmianie obie kolumny miałyby
identyczny nagłówek. Dlatego rozstrzygnięcie „Pkt" dotyczy tylko punktów
zdobytych, a **punkty za zwycięstwo trzeba przemianować**, np.:

- `doc.colPts` → „Win" w tabeli zbiorczej, „Pkt" w wąskiej (rekomendowane —
  kolumny nigdy nie wyglądają identycznie)
- albo `doc.colPts` → „Pkt za wyg." (dłuższe, jednoznaczne, ale za szerokie
  na wąski wydruk)

**Do rozważenia:** `st.colConceded` ('Bramki stracone') ma ten sam problem.

## 3. Terminarz: osobna strona na każdy dzień, data w nagłówku

**Status: prawdopodobnie już działa.** W `src/engine/output.ts` funkcja
`scheduleSections` (linia 329) grupuje mecze po dniach przez `sameDay()`, robi
osobną sekcję dla każdego dnia, ustawia `pageBreakBefore: i > 0`, a tytuł
sekcji to `doc.timetableDay` = 'Terminarz — {day}'. W `src/engine/pdf.ts`
klasa `.break` daje `break-before: page`.

**Co do zrobienia:** potwierdzić na wydruku, nie tylko w podglądzie:
- czy `break-before: page` jest respektowane przez „Drukuj → Zapisz jako PDF"
  z przeglądarki, a nie tylko przez podgląd w aplikacji;
- czy jeden dzień to jedna strona, czy długi dzień wciąż się dzieli — przy
  wielu godzinach jedna strona to za mało, więc to raczej „zacznij od nowej
  strony dla każdego dnia" niż „mocno ogranicz do jednej";
- nagłówek strony z datą (`doc.timetableDay`) jest tytułem sekcji, nie
  powtarzalnym nagłówkiem druku — przy druku wielostronicowym data zniknie
  ze stron drugich.

## 4. Więcej customizacji dokumentów — dowolny napis do zmiany

**Gdzie:** `src/engine/branding.ts`. Dziś `Branding` ma 12 pól:

- teksty: `eventTitle`, `subtitle`, `edition`, `headerNote`, `footerNote`, `notes`
- obrazy: `logoDataUrl`, `sponsorDataUrl`
- kolor: `accent`
- przełączniki: `showVenueDate`, `showAdvancedStats`, `compactStandings`

**Czego brakuje** (każdy wymaga klucza w `src/i18n/{en,pl,de,es}.ts`):
- nazwy wszystkich dokumentów ('Terminarz', 'Wyniki', 'Drabinka')
- nagłówków kolumn ('Miejsce', 'Runda', 'Godzina', 'Wynik')
- etykiet w stopce i nagłówku druku
- tytułu dokumentu w metadanych pliku
- nazwy pliku (obecnie generowana automatycznie)
- formatu daty i godziny (teraz `fmtDateFull` / `fmtTime` na sztywno)

**Konwencja:** `normalizeBranding` czyści każde pole przez `clean()` z limitem
długości z `TEXT_LIMITS`. Nowe pola muszą dostać wpis w `TEXT_LIMITS`, inaczej
`pick()` ich nie obsłuży. Brak wpisu = cicha utrata tekstu.

**Ryzyko:** klucze i18n muszą istnieć we wszystkich czterech słownikach —
`tests/localization-audit.test.ts` to sprawdza i każda luka wywala testy.

## 5. Zakładka „Regulamin" + regulamin w generowanych dokumentach

**Dlaczego:** dziś jest `branding.notes` — jeden blok tekstu „Printed block
near the end: notes, disclaimer, regulations", wypluwany bez struktury. Nie da
się go nazwać ani podzielić, a regulamin to zwykle kilka punktów.

**Do zrobienia:**
- **a) Zakładka w UI.** Najpewniej osobna pozycja w kreatorze lub Ustawieniach.
- **b) Pole danych.** Nowy obiekt zamiast jednego `notes`, np.
  `regulation: { title: string; body: string; includeInDocs: boolean }`.
  Dodany do `Branding` — wtedy wjedzie razem z resztą do pliku projektu i do
  synchronizacji LAN za darmo, bo `branding` już się tam przewozi.
- **c) Osobny dokument.** `DocKind` w `src/engine/output.ts` (rozgałęzienie
  przy linii 524) plus renderer w `src/engine/pdf.ts`.
- **d) Blok w istniejących dokumentach.** Dołączyć do „pack" (dokument zbiorczy,
  `packSections`) i do dokumentu wyników, skoro regulamin ma być „w generowanych
  dokumentach".
- **e) Klucze i18n** w czterech słownikach.

**Uwaga:** `notes` jest dziś w `TEXT_LIMITS` z limitem 1200 znaków. Regulamin
bywa dłuższy — potrzebny osobny limit (np. 5000) albo osobne pole, bo
`clean()` ucina po 1200 znaków po cichu.

## 6. Sezony i serie turniejów (wielowybraniowe)

**Co to jest:** nie pojedynczy event, tylko cały cykl.

**Zakres:**
- klasyfikacja sezonu
- punkty z wielu turniejów
- ranking klubowy
- historia zawodnika / drużyny

**To jest duża zmiana modelu danych.** Projekt `.top.json` opisuje dziś
jeden turniej — nazwa, format, drabinka, uczestnicy. Sezon wymaga warstwy
wyżej, która trzyma wiele turniejów i liczy sumy. Do zaprojektowania od zera:

- czym jest „sezon" w pliku projektu (osobny plik? czy turniej z polem `seasonId`?)
- przenoszenie wyników: kopiować do sezonu czy trzymać referencje?
- co się dzieje z edycją turnieju już wliczonego do klasyfikacji
  (przeliczyć? zablokować?)

**Ryzyko:** dotyka `engine/types.ts`, zapisu projektu i synchronizacji LAN.
Synchronizacja LAN dziś synchronizuje jeden projekt — sezon zmienia to
z założenia.

**Stan:** zapisane, nie realizowane.

## 7. Warstwa dyscypliny sportowej + presety zależne od dyscypliny

### Główna zasada

Najpierw użytkownik wybiera **dyscyplinę**, a dopiero potem pojawia się
lista presetów dopasowanych do tej dyscypliny. Aplikacja podmienia
nazewnictwo pól, ustawia domyślne zasady punktacji i remisów, a użytkownik
może preset wczytać i dalej edytować.

Krótko: **dyscyplina → presety → nazwy pól → reguły → edytowalny preset.**

### Nazewnictwo zależne od dyscypliny

To samo pole ma inne nazwy w zależności od dyscypliny:

| Pole neutralne | Sport | Nazwa |
|---|---|---|
| miejsce | siatkówka, piłka nożna | boisko |
| miejsce | ping-pong | stół |
| miejsce | badminton, tenis | kort |
| uczestnik | szachy | zawodnik |
| uczestnik | siatkówka | drużyna |
| mecz | siatkówka, tenis | set |
| mecz | pływanie, kolarstwo | wyścig |
| mecz | lekkoatletyka | bieg |
| mecz | boks, zapasy | pojedynka |

**Konflikt z punktem 1 tej listy.** Punkt 1 mówi: zamień „boisko / stół" na
„miejsce", bo aplikacja ma być neutralna. Punkt 7 mówi: pokaż „boisko"
w siatkówce i „stół" w ping-pongu. To dwa sprzeczne wymagania.

Rozwiązanie: **wartość techniczna zawsze neutralna** — `court`, `table`,
`station`, wewnętrznie i w kodach QR. **Etykieta zależna od dyscypliny** —
tylko tekst na ekranie. Dziś `sch.kindCourt` = „Boisko" jako etykieta i
`court` jako wartość; warstwa dyscypliny nadpisuje etykietę, nie wartość.
Nawiasem: to jest dokładnie ta uwaga zapisana przy punkcie 1.

### Presety przykładowe

**Siatkówka:** turniej amatorski 2x2 · turniej szkolny · liga drużynowa ·
grupy + faza pucharowa · siatkówka plażowa
Domyślnie: brak remisów, punkty wg setów, nazwy: boisko / set / drużyna.

**Ping-pong:** liga klubowa · turniej drabinkowy · grupy + play-off · Swiss
dla większej liczby graczy
Domyślnie: stół zamiast miejsca, remisy zależnie od reguł, jeden zawodnik.

**Szachy:** Swiss klubowy · round robin · drabinka KO · turniej klasyczny
Domyślnie: zawodnik, remisy dozwolone, punktacja szachowa, tie-breaki istotne.

**Piłka nożna:** liga · grupy + puchar · turniej jednodniowy · mały amatorski
Domyślnie: boisko, drużyny, remisy zależnie od etapu, dogrywki i karne.

**Badminton / tenis stołowy / regaty:** do ustalenia, brak presetów.

### Co ma działać automatycznie po wyborze dyscypliny

1. **Nazewnictwo** — nie tylko etykiety, także podpowiedzi, przyciski, nagłówki
   tabel, podsumowanie, PDF-y i wydruki.
2. **Presety** — inna lista dla każdej dyscypliny.
3. **Domyślne zasady** — siatkówka: brak remisów. Szachy: remisy normalne.
   Piłka nożna: remis możliwy w grupie, zależnie od etapu.
4. **Widoczne opcje** — remisy, dogrywka, liczba setów, punkty za przegraną,
   nazwa obiektu, typ uczestnika mają znikać albo zmieniać znaczenie.

### Reguła: preset to punkt startowy

Preset **nie jest sztywnym szablonem**. Można go od razu użyć, edytować
i zapisać jako własny wariant.

### Gdzie w kodzie

- `src/i18n/*.ts` — dziś 4 słowniki (en, pl, de, es). Nowy zestaw kluczy
  na dyscyplinę, czyli co najmniej ×4.
- `src/engine/branding.ts` — nazwa obiektu i typ uczestnika to dziś tam.
  Warstwa dyscypliny musi się z tym pogodzić, żeby nie było dwóch konkurujących
  źródeł etykiet.
- `src/engine/modes.tsx` (28,6 KB, 28 presetów formatów) — tu żyją istniejące
  presety. Kluczowe pytanie: czy to one mają zostać, czy warstwa dyscypliny ma
  je zastąpić. Podwójny zestaw presetów bez jasnej reguły to zapach zgnilizny.

### Ryzyka

- `localization-audit.test.ts` wymaga kompletu kluczy we wszystkich słownikach —
  każdy nowy klucz × dyscyplina × 4 języki.
- Nazwy pól są dziś używane w PDF-ach i wydrukach, więc etykieta zależna od
  dyscypliny musi dojechać też do generatora dokumentów, nie tylko do UI.
- Ekrany publiczne i QR też mają „mówić" językiem dyscypliny.
**Stan:** zapisane, nie realizowane.

## 8. Licznik punktów / wyników na żywo

### Co robi

Użytkownik klika zaplanowany mecz, aplikacja otwiera prosty ekran liczenia
punktów. Dodawanie i odejmowanie, liczenie setów / rund / gemy / punktów
zależnie od dyscypliny, wynik na bieżąco, **autozapis po każdej zmianie**.
Wynik nie jest czymś, co trzeba osobno „zatwierdzać" — zmiana trafia do
meczu od razu.

**Ważne:** ręczne wpisywanie wyniku zostaje. Licznik jest **opcjonalny**.

### Najważniejsze cechy UI

1. **Duże przyciski** — `+` / `-`, duże cyfry, czytelne kolumny dla obu stron,
   zero drobnych elementów. Ma działać w hali, przy stoliku sędziowskim,
   na tabletach i małych ekranach.
2. **Błyskawiczny zapis** — każde kliknięcie aktualizuje wynik, zapisuje stan
   i przelicza tabelę / drabinkę / kolejną rundę. Bez ręcznego „zapisz".
3. **Cofanie punktów** — ostatni punkt, ostatnia akcja, cały set / runda /
   zdarzenie. Sędzia w realnym turnieju często kliknie za dużo.

### Funkcje A–I

| | Funkcja | Uwagi |
|---|---|---|
| A | Liczenie punktów | `+1` / `-1`; w zależności od dyscypliny `+2` / `+3`, szybkie ustawienie wartości, edycja ręczna |
| B | Automatyczne sety / rundy / okresy | po osiągnięciu progu set kończy się sam, licznik przechodzi dalej, wynik seta zapisany |
| C | Konfiguracja progów | ile punktów wygrywa set, ile setów wygrywa mecz, różnica 2, limit czasu, dogrywki, koniec automatyczny czy z potwierdzeniem |
| D | Wynik meczu i pośredni | równocześnie: punkty w secie 18–14, sety 1–0, mecz 1–0 |
| E | Ręczne zakończenie | potwierdzić koniec, oznaczyć zwycięzcę, walkower, przerwanie, odłożenie, powrót później |
| F | Cofanie i historia | ostatnia zmiana, kilka akcji wstecz, pełny reset, przywrócenie stanu |
| G | Blokady i potwierdzenia | reset, nadpisanie istniejącego rezultatu, zakończenie meczu, zmiana zwycięzcy po zapisie, odwrócenie walkowera |
| H | Tryb sędziego / operatora | tylko mecz, wynik, `+` / `-`, aktualna faza, bez zbędnych ustawień |
| I | Tryb publiczny | większa typografia, tylko wynik bez przycisków, odświeżanie na żywo, nazwy zawodników, aktualny set / runda |

### Zależne od dyscypliny

- **Siatkówka:** punkty w secie, automatyczny koniec seta po progu, brak remisów,
  liczenie setów, ewentualny tie-break, zmiana serwisu.
- **Ping-pong:** punkty do seta, sety do meczu, szybkie liczenie, automatyczny
  koniec seta, różne progi dla różnych rozgrywek.
- **Badminton:** punkty w secie, progi setów, brak remisów, automatyczny koniec
  meczu po odpowiedniej liczbie setów.
- **Szachy:** prostszy licznik — 1–0 / 0–1 / remis, szybkie ustawienie wyniku.
  Zegar może być osobnym modułem, nie musi być w tej samej funkcji.
- **Piłka nożna:** gole, ewentualnie kartki, dogrywka, karne. Bez

1. **Edycja zwycięzcy bez przepisywania wyniku** — zmiana zwycięzcy, korekta
   jednej strony, wpisanie remisu tam, gdzie to ma sens.
2. **Zapis częściowy** — rozpoczęty / w trakcie / przerwany / zakończony /
   do poprawy.
3. **Przerwa techniczna** — timeout, przerwa, odłożenie, kontynuacja później.
4. **Walkower** — zwycięzca walkowerem, przegrany walkowerem, wynik automatyczny.
5. **Reset meczu** — wyzerowanie wyniku jednym kliknięciem, z potwierdzeniem.
6. **Zmiana kolejności stron** — zawodnik A ↔ B, drużyna domowa ↔ gość.
7. **Statystyki pomocnicze** — punkty, sety, błędy, kartki, kary.
8. **Skróty klawiszowe** — `+`, `-`, `Enter`, `Backspace`, `Esc`, `Ctrl+Z`.
9. **Blokada przy błędnych danych** — mecz bez poprawnych uczestników albo
   format niedopuszczający remisu nie powinien przyjmować sprzecznego zapisu.

### Przebieg pracy

Organizator wybiera zaplanowany mecz → otwiera się licznik → sędzia klika
duże przyciski → wynik zapisuje się od razu → próg seta/rundy przechodzi
dalej automatycznie → po końcu wynik trafia do tabeli / drabinki / kolejki →
w razie potrzeby cofanie albo poprawka później.

### Uwagi projektowe

- **Autozapis to zmiana kontraktu danych.** Dziś mecz ma wynik jako parę
  liczb (`homeScore` / `awayScore`, widać w `scoreOf`). Licznik z progami
  setów wymaga struktury, która trzyma więcej niż jedną liczbę: sety, rundy,
  zdarzenia. To nie jest rozszerzenie istniejącego pola, tylko zamiana go
  na strukturę — z **migracją** starych plików i z backward compatibility.
  Inaczej stare projekty przestaną się otwierać.
- **Punkt 9 (blokada przy błędnych danych)** wymaga walidacji w silniku, nie
  tylko w UI. Licznik jest dziś jednym z kilku sposobów wpisania wyniku,
  więc ta sama walidacja musi chronić ręczne wpisywanie.
- **Zależność od punktu 7:** progi setów i logika meczu („kiedy set się
  kończy") to dokładnie reguły dyscypliny z warstwy dyscypliny. Licznik
  bez punktu 7 musiałby hardkodować reguły na sztywno. **Najpierw 7, potem 8.**
- `Ctrl+Z` i historia akcji dobrze się kłócą z istniejącym Undo w edytorze
  wyników — trzeba ustalić, czy to ten sam mechanizm, czy osobny stos.

**Stan:** zapisane, nie realizowane.

## Kolejność

1. **Punkt 2** — najmniejsza zmiana, największy efekt, jeden problem do
   przemyślenia (kolizja nagłówków kolumn).
2. **Punkt 1** — w tekście, bez ruszania modelu danych. Realne ryzyko:
   pomylić klucz z wartością techniczną.
3. **Punkt 3** — najpewniej tylko weryfikacja, nie praca.
4. **Punkt 5b** — model danych, przed jakąkolwiek pracą nad UI.
5. **Punkt 4** — najszerszy, warto po punkcie 5, bo regulamin i tak wymaga
   nowych pól brandingu.
6. **Punkt 5a i 5c–5e** — dookoła gotowego modelu.
7. **Punkt 7** — warstwa dyscypliny. Fundament: bez niej punkty 8 i 9
   musiałyby hardkodować reguły każdego sportu osobno.
8. **Punkt 8** — licznik, dopiero na warstwie dyscypliny.
9. **Punkt 6** — wspólny mechanizm sezonu; największa zmiana modelu danych
   i zapisu pliku, sensownie na końcu.

## Czego nie sprawdzałem

- nie uruchamiałem podglądu druku dla punktów 3 i 5
- nie czytałem `modes.tsx` — wiem tylko z rozmiaru pliku, że jest tam 28 presetów
  formatów, ale nie sprawdzałem, jak są zorganizowane (punkt 7 zależy od tego)
- nie sprawdzałem, jak wygląda struktura wyniku meczu w `types.ts` poza
  pośrednim śladem w `scoreOf` (punkt 8 zależy od tego)
- nie wiem, czy istnieją pliki projektu zapisane ze starym `branding.notes` —
  migracja pola musi zachować dotychczasowy tekst
- punkt 2 zmienia wygląd tabeli, więc przy wdrożeniu trzeba zdecydować,
  czy nagłówek punktów za zwycięstwo to „Win" czy „Pkt za wyg."

