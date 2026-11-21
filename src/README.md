# Assurance Learning Calendar

React 18.3.1 + TypeScript + SCSS modules source for the SPFx 1.24.1 web part **assuranceLearningCalendar**
(solution **Assurance-Learning-Calendar**). Every component is a `React.PureComponent`.

The page has the banner, the Filters bar (Course Name autocomplete, Region, Offerings, date range,
Apply / Reset / Export Excel), the sortable course table with expandable rows, the Monday–Friday month
calendar with multi-day event bars and hover tooltips, and the session-details dialog.

## Folder layout

```
src/
  index.ts
  webparts/assuranceLearningCalendar/
    AssuranceLearningCalendarWebPart.ts          SPFx web part (property pane, data source switch)
    AssuranceLearningCalendarWebPart.manifest.json
    loc/                                         en-us.js + mystrings.d.ts
    components/
      AssuranceLearningCalendar.tsx (+ .module.scss)   container: state, filtering, sorting
      HeroBanner/   HeroBanner, HeroArt (vector stand-in for the banner photo)
      Filters/      Filters, Dropdown, DateRangePicker, PillButton
      CourseTable/  CourseTable, CourseRow
      MonthCalendar/MonthCalendar, CalendarEvent
      CourseModal/  CourseModal
      Icons/        Icon (inline SVG)
      styles/_variables.scss
    models/ICourse.ts
    services/       ICourseService, LocalCourseService, SharePointCourseService
    data/localCourses.ts                         sample data from the Excel sheet
    utils/          dateUtils, courseUtils, calendarLayout, excelExport (no dependencies)
dev/                local test harness, kept apart from the SPFx files
  index.html, main.tsx, harness.css
  vite.config.mts   Vite config (finds a shared node_modules automatically)
  tsconfig.json     harness-only type-check (SPFx keeps its own root tsconfig.json)
scripts/            SharePoint list provisioning + sample CSV
```

Nothing of the harness sits at the project root, so the folder can go straight into an SPFx solution
without clashing with SPFx's `package.json` scripts, `tsconfig.json` or `gulpfile.js`/config files.

## 1. SharePoint workspace with a shared node_modules

Expected layout:

```
sharepoint-workspace/
  package.json            { "private": true, "workspaces": ["projects/*"] }
  package-lock.json       the only lock file
  node_modules/           shared by every project
  projects/
    Assurance-Learning-Calendar/   SPFx solution (config/, src/, dev/, scripts/, package.json, tsconfig.json)
```

Node, TypeScript, Sass and Vite all look for packages in parent folders, so no paths change in code.

**Project `package.json`** – keep the SPFx-generated one and merge in only these parts of this repo's
`package.json` (do **not** add `"type": "module"`, it breaks SPFx's CommonJS config files):

```json
"scripts": {
  "dev:local": "vite --config dev/vite.config.mts",
  "build:local": "tsc -p dev/tsconfig.json && vite build --config dev/vite.config.mts",
  "typecheck:local": "tsc -p dev/tsconfig.json",
  "sample-csv": "node scripts/make-sample-csv.mjs"
},
"dependencies": {
  "react": "18.3.1",
  "react-dom": "18.3.1",
  "@microsoft/sp-http": "1.24.1",
  "@microsoft/sp-loader": "1.24.1"
},
"devDependencies": {
  "@vitejs/plugin-react": "4.3.4",
  "sass": "1.83.0",
  "vite": "5.4.11"
}
```

SPFx already supplies `typescript` and `@types/react`. Use `@types/react` 18.3.x to match React 18.3.1.

Rules for the shared folder:

- Install only from the workspace root (`npm install`). Running `npm install` inside the project
  creates a project-level `node_modules` and lock file.
- Don't copy this folder's `node_modules` or a `package-lock.json` into the workspace project.
- Each project's `name` must be unique (`assurance-learning-calendar` here).
- Only one React version can be hoisted to the shared `node_modules`. If other projects use React 17,
  npm puts React 18.3.1 in this project's own `node_modules`. Check with `npm ls react` from the root.
  The harness forces a single React copy (`resolve.dedupe`).
- Vite's cache goes to `<shared node_modules>/.vite/assurance-learning-calendar`, and its file-serving
  allow-list includes the workspace folder, so the shared `node_modules` can be served.

## 2. Test locally (local list)

From the workspace root:

```powershell
npm run dev:local -w assurance-learning-calendar
```

or from the project folder (npm finds the commands in the parent `node_modules`):

```powershell
npm run dev:local
```

Open http://localhost:5173. The bar at the top resizes the web part to typical SharePoint section
widths (full, 1280, 960, 1/2, 1/3). All responsive rules use **container queries** on the web part's own
width, so it adapts inside narrow SharePoint columns, not just on small screens.

`npm run build:local` type-checks and builds the harness into `dist-local/` (git-ignored).

## 3. Put it into the SPFx 1.24.1 project

1. Scaffold the solution `Assurance-Learning-Calendar` with a React web part named `assuranceLearningCalendar`
   under `projects/`.
2. Copy `src/`, `dev/` and `scripts/` into it. Either keep the `id` from your scaffolded
   `AssuranceLearningCalendarWebPart.manifest.json` or use the one provided here.
3. Merge the `package.json` parts shown above, then run `npm install` from the workspace root.
4. `config/config.json` should already contain (the scaffold creates it with these names):

   ```json
   "localizedResources": {
     "AssuranceLearningCalendarWebPartStrings": "lib/webparts/assuranceLearningCalendar/loc/{locale}.js"
   }
   ```

5. Build and serve as usual for your toolchain.

The web part uses `createRoot` from `react-dom/client` (React 18). Open Sans is loaded with
`SPComponentLoader.loadCss`; if your tenant blocks Google Fonts it falls back to Segoe UI.

## 4. SharePoint list `AssuranceLearningCalendar`

Create the list (and optionally import data) with PnP.PowerShell:

```powershell
.\scripts\Provision-AssuranceLearningCalendarList.ps1 -SiteUrl https://<tenant>.sharepoint.com/sites/<site> -ClientId <entra-app-id> -CsvPath .\scripts\AssuranceLearningCalendar.sample.csv
```

To load the real data, save the Excel export as **CSV UTF-8** and pass it as `-CsvPath`
(the script reads the Excel column headers directly). Add `-ClearExistingItems` to replace existing rows.

| Column (internal name) | Type | Excel column |
|---|---|---|
| Title (shown as Course Title) | Single line | eventName |
| StartDate / EndDate | Date only | startDateString / endDateString (dd-mm-yyyy) |
| StartTime / EndTime | Single line, e.g. `01:00 PM` | startTime / endTime (zone in brackets is stripped) |
| TimeZone | Choice (ET, CT, MT, PT, IST) | timeZone |
| CPECredits | Number | CPECredits |
| Duration | Number (hours) | Tduration |
| TrainingType | Choice (Virtual, In-Person) | trainingType |
| DeliveryType | Single line, default `Virtual Live` | – |
| RegistrationLink | Hyperlink | RegistrationLink |
| AboutCourse / Objectives | Multiple lines (plain) | AboutCourse / Objectives (`•` separates bullets) |
| RecordedLink | Hyperlink | recordedLink (`NA` = empty) |
| Offering | Choice | offering |
| Region | Choice (US, US, USI, USI) | Region |

Then in the web part's property pane set **Data source** to *SharePoint list*. **List name** defaults to
`AssuranceLearningCalendar`; **Site URL** is optional (defaults to the current site).

## Behaviour notes

- Filters only apply when **Apply** is pressed; **Reset** clears filters and sorting.
- Region matching is by token: `US` also matches `US, USI`.
- The date range keeps classes that overlap the range. After Apply, the calendar jumps to the range's month
  (or to the next matching class when filtering by name, region or offering).
- **Export Excel** downloads the currently filtered rows as `ExcelFile_export_<timestamp>.xlsx`, with the
  same 15 columns as the source sheet. It is a real .xlsx written without any library.
- Click a table row to expand *About Course* / *Objectives* and the **More Information** (registration) button.
  Click a calendar bar to open the session details dialog.

## Data caveats

`data/localCourses.ts` was transcribed from photos of the Excel sheet. Long text cells were cut off on screen,
so several *About* and *Objectives* texts were completed by hand, and the Saba base URL
(`.../Web_spf/E103PRD0001/...`) should be checked. The two November 2026 classes come from the calendar
screenshots, and their registration links were not visible. Import the real Excel file into the list to replace all of this.

The banner photo is replaced by a vector illustration (`HeroArt.tsx`). Set **Banner image URL** in the
property pane to use the real photo.
