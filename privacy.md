# Folio Privacy Policy

Last updated: July 8, 2026

Folio is a Chrome extension that helps users store a private autofill profile and fill form fields only when they ask Folio to do so.

## Summary

Folio is designed to keep your profile data local to your browser.

- Folio does not sell user data.
- Folio does not use user data for advertising.
- Folio does not transfer your profile, resume files, or form answers to Folio servers.
- Folio does not collect analytics through a Folio backend.
- Folio scans and fills pages only when the user requests it.

## Data Folio Stores

Folio may store the following information if you choose to enter or upload it:

- Personal profile details, such as name, email address, phone number, address, LinkedIn, GitHub, and portfolio links.
- Education history.
- Work experience.
- Skills.
- Resume or document files that you upload.
- Extension preferences, such as whether Folio is enabled and your selected theme.
- Local usage metrics, such as filled field counts, form fill counts, document usage counts, and local activity history.

This data is stored in Chrome extension local storage on your device using `chrome.storage.local`.

## How Folio Uses Data

Folio uses locally stored data to:

- Match your saved profile information to form fields.
- Fill forms when you click the Folio extension and request a fill action.
- Show your saved profile, documents, and local activity inside the extension settings page.
- Export or import your Folio profile when you choose to do so.

Folio does not automatically fill forms in the background. Folio is intended to scan and fill pages only after user interaction.

## Page Content

When you use Folio on a web page, the extension may inspect visible form fields on the current active tab to determine whether those fields match your saved local profile data.

Folio does not store the full content of pages you visit. Folio uses field labels, field names, placeholders, and nearby form text only to identify form fields and perform local matching.

## Data Sharing

Folio does not share your saved profile, uploaded documents, resume files, or form data with third parties.

Folio may make a request to the GitHub API at `https://api.github.com/` to display the public star count for the Folio GitHub repository. This request is not used to send your profile data, resume data, or page form data to GitHub.

## Remote Servers

Folio does not operate a backend server for collecting or processing user profile data.

## Data Export And Import

Folio allows you to export your locally stored profile as a JSON file and import it later. Exported files are controlled by you. Be careful when sharing exported profile files because they may contain personal information and uploaded document data.

## Data Retention And Deletion

Folio keeps data in local Chrome extension storage until you delete it, import another profile, clear extension storage, or uninstall the extension.

You can delete Folio data by:

- Removing saved information inside the extension settings.
- Clearing the extension's local storage.
- Uninstalling the Folio extension from Chrome.

## Permissions

Folio requests the following Chrome extension permissions:

- `storage`: to save your Folio profile and settings locally.
- `activeTab`: to access the current tab only after user interaction.
- `scripting`: to scan and fill form fields on the active page when requested.

Folio also requests access to `https://api.github.com/*` only to fetch the public GitHub repository star count.

## Children's Privacy

Folio is not directed to children under 13. Folio does not knowingly collect personal information from children.

## Changes To This Policy

This privacy policy may be updated when Folio changes how it handles data. The updated policy will be published with a new "Last updated" date.

## Contact

For questions about this privacy policy, open an issue on the Folio GitHub repository:

https://github.com/omarbhl/Folio

