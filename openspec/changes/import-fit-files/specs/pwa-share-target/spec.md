## ADDED Requirements

### Requirement: PWA share target registration
The system SHALL register a `share_target` in the web app manifest to accept `.fit` file shares from the operating system.

#### Scenario: Manifest includes share_target
- **WHEN** user views the manifest.json
- **THEN** it includes a `share_target` block accepting `application/octet-stream` files and routing them to `/import` with a `file` query parameter placeholder

#### Scenario: App appears in share sheet
- **WHEN** user selects a `.fit` file in a file manager or email and opens the share menu
- **THEN** the app appears as a share target option on supported platforms

### Requirement: Handle shared FIT files via service worker
The system SHALL use a service worker to intercept incoming shared files and deliver them to the import page.

#### Scenario: Service worker intercepts share POST
- **WHEN** the app receives a share intent POST request
- **THEN** the service worker caches the file data and redirects the client to `/import?shared=true`

#### Scenario: Import page detects shared files
- **WHEN** the import page loads with `?shared=true` in the URL
- **THEN** it retrieves the shared file data from the service worker cache and adds it to the import queue

### Requirement: Graceful fallback for unsupported browsers
The system SHALL handle the case where the share target API is not supported.

#### Scenario: Share target unavailable
- **WHEN** the app runs on a platform that does not support PWA share targets
- **THEN** the import page still works via manual file upload and the share feature is simply unavailable (no error shown)
