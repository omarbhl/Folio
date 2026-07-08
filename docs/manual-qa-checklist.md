# Folio Manual QA Checklist

Use this checklist before publishing a Chrome Web Store build.

## Build Under Test

- Version:
- Commit SHA:
- Tester:
- Date:
- Browser:
- OS:

## Setup

- [ ] Run `npm.cmd run build`.
- [ ] Confirm `dist/manifest.json` exists.
- [ ] Open `chrome://extensions`.
- [ ] Enable Developer mode.
- [ ] Click **Load unpacked** and select `X:\Github Repos\Folio\dist`.
- [ ] Confirm Folio appears without extension errors.
- [ ] Pin Folio to the toolbar.
- [ ] Open `X:\Github Repos\Folio\test-form.html` in Chrome.

## First Launch

- [ ] Click the Folio toolbar icon.
- [ ] Popup opens at the expected compact size.
- [ ] Logo, refresh, settings, and power button align cleanly.
- [ ] No text overlaps or clipped buttons.
- [ ] Settings button opens the options page.
- [ ] No console errors appear in the popup DevTools.

## Extension On/Off

- [ ] Turn Folio off from the popup.
- [ ] Off state uses the same polished visual style as the on state.
- [ ] Power icon is visibly red/off.
- [ ] Main action says to turn Folio on.
- [ ] Clicking the main off-state action turns Folio on.
- [ ] Turning on/off shows the intended animation.
- [ ] When off, Folio does not scan or fill the page.
- [ ] Reload the page while off and confirm Folio remains off.
- [ ] Turn Folio back on.

## Scan And Fill Behavior

- [ ] Folio does not scan automatically before clicking the popup action.
- [ ] Open `test-form.html`.
- [ ] Click the Folio toolbar icon.
- [ ] Confirm detected field count is accurate enough for the visible test form.
- [ ] Click fill action.
- [ ] Expected fields are filled.
- [ ] Filled fields fire `input` and `change` events in the test log.
- [ ] Controlled fields, especially email, are recognized as filled by the page.
- [ ] Select/dropdown fields update correctly.
- [ ] Resume upload dropdown looks like a selectable dropdown.
- [ ] Badge number is not shown on the extension icon.

## Options Page Topbar

- [ ] Open options page.
- [ ] Topbar height stays fixed when changing tabs.
- [ ] Logo area does not jump.
- [ ] GitHub star button looks inviting and includes the GitHub logo.
- [ ] GitHub star count loads dynamically.
- [ ] Theme controls work.
- [ ] Save button state updates correctly after edits.
- [ ] No `Saved locally` pill appears in the topbar.

## Analytics Tab

- [ ] Analytics data reflects real profile/local usage data.
- [ ] Applications autofilled is dynamic.
- [ ] Hours saved is dynamic.
- [ ] Profile completeness is dynamic.
- [ ] Documents saved is dynamic.
- [ ] Profile completion rows update after editing profile data.
- [ ] Most filled labels section is based on tracked fills, not hardcoded demo data.
- [ ] Most used documents is based on document usage data.
- [ ] Recent activity is based on the local activity log.
- [ ] Empty states look intentional when there is little or no data.

## Profile Tab

- [ ] Personal profile fields save and reload correctly.
- [ ] Country selector works.
- [ ] City selector updates based on country where available.
- [ ] Phone, email, address, and links accept realistic values.
- [ ] No old “Personal Informations” text remains.

## Documents Tab

- [ ] Resume/document upload works.
- [ ] Uploaded document appears in the document list.
- [ ] Document metadata looks clean.
- [ ] Tags can be added/edited if available.
- [ ] Deleting a document prompts clearly.
- [ ] Export/import still includes document metadata.

## Skills Tab

- [ ] Adding a skill works.
- [ ] Duplicate skill handling is acceptable.
- [ ] Removing a skill works.
- [ ] Layout does not stretch or resize the navbar.

## Education Tab

- [ ] Education timeline appears on the left.
- [ ] Timeline card height matches the editor well.
- [ ] Clicking a timeline entry selects it.
- [ ] Selected entry is highlighted.
- [ ] Editor shows the selected education entry.
- [ ] Add education creates a new selectable entry.
- [ ] Delete removes only the selected entry.
- [ ] Cancel restores unsaved changes for the selected entry.
- [ ] Save persists changes after reload.
- [ ] Empty/new entry state looks clean.
- [ ] Mobile/narrow viewport remains usable.

## Experience Tab

- [ ] Experience timeline visually matches the Education timeline.
- [ ] Timeline entries show date range, title, company, and location where available.
- [ ] Clicking a timeline entry selects it.
- [ ] Selected entry is highlighted.
- [ ] Editor shows the selected experience entry.
- [ ] Add experience creates a new selectable entry.
- [ ] Current role toggle disables/enables end date correctly.
- [ ] Delete removes only the selected entry.
- [ ] Cancel restores unsaved changes for the selected entry.
- [ ] Save persists changes after reload.
- [ ] No old avatar-style experience list remains.
- [ ] Mobile/narrow viewport remains usable.

## AI Tab

- [ ] Tab is named **AI**.
- [ ] It shows a clean coming-soon placeholder.
- [ ] No custom answers/autolearn UI remains.
- [ ] No old Answers tab remains.

## Settings Tab

- [ ] Settings shows import/export and placeholder areas only.
- [ ] JSON editor is not visible.
- [ ] Export JSON downloads a valid Folio profile.
- [ ] Exported JSON includes the app version.
- [ ] Import JSON restores profile data.
- [ ] Invalid JSON import fails gracefully.

## Persistence

- [ ] Edit data in each major section.
- [ ] Click Save.
- [ ] Close and reopen options.
- [ ] Confirm saved data remains.
- [ ] Reload extension from `chrome://extensions`.
- [ ] Confirm saved data remains.
- [ ] Export JSON.
- [ ] Clear extension storage manually.
- [ ] Import JSON.
- [ ] Confirm restored data matches expectations.

## Privacy And Security

- [ ] Extension does not request broad host permissions.
- [ ] Manifest permissions are limited to expected values.
- [ ] Profile data stays local during normal usage.
- [ ] Network tab shows no unexpected requests while editing profile data.
- [ ] GitHub API request is only used for star count.
- [ ] Folio does not scan pages when off.
- [ ] Folio only scans/fills when the user asks.
- [ ] Test on Instagram or another sensitive site and confirm no passive scanning warning appears.
- [ ] No remote code execution, `eval`, or injected external scripts.

## Chrome Web Store Package

- [ ] `npm.cmd run build` passes.
- [ ] Create ZIP from the contents of `dist`, not the parent folder.
- [ ] ZIP root contains `manifest.json`.
- [ ] ZIP includes icons.
- [ ] ZIP excludes source files, `node_modules`, and dev-only files.
- [ ] Upload ZIP to Chrome Web Store draft.
- [ ] Store dashboard accepts the package.
- [ ] Permission warnings match expectations.

## Store Listing Readiness

- [ ] Short description is final.
- [ ] Full description is final.
- [ ] Screenshots are current and polished.
- [ ] Promo assets are ready.
- [ ] Category is selected.
- [ ] Support/contact URL is set.
- [ ] Privacy policy URL is set.
- [ ] Single-purpose explanation is clear.
- [ ] Permission justifications are clear.
- [ ] Data usage answers match actual behavior.

## Final Decision

- [ ] No blocking bugs found.
- [ ] No high-risk privacy/security issues found.
- [ ] UI feels polished enough for first public release.
- [ ] Ready to submit for Chrome Web Store review.

## Notes

Add any issues, screenshots, or follow-up tasks here.
