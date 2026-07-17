# Testing

Run all automated tests:

```bash
npm test
```

Run the production build:

```bash
npm run build
```

Covered scenarios include:

- Valid submission
- Blank submission
- Too-short submission
- Oversized submission
- Whitespace normalization
- HTML and script-like input
- Duplicate detection
- Double-click prevention
- API failure state
- Unauthorized page
- CSV formula injection protection
- Presenter filtering display

Recommended manual checks before the event:

- Submit a test question from a phone outside the OEP tenant.
- Confirm `/admin` requires Entra sign-in.
- Confirm an unauthorized account lands on `/unauthorized`.
- Select a question and confirm it appears in `/present`.
- Export CSV and open it in Excel.
- Close submissions and confirm the public closed message appears.
