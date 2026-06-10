## ADDED Requirements

### Requirement: Import page with drag-and-drop zone
The system SHALL provide a `/import` page with a drag-and-drop zone for selecting multiple `.fit` files.

#### Scenario: Drag files onto drop zone
- **WHEN** user drags one or more `.fit` files onto the drop zone
- **THEN** the files are added to an import queue with "queued" status

#### Scenario: Click to select files
- **WHEN** user clicks the drop zone or a dedicated file picker button
- **THEN** a file picker dialog opens accepting only `.fit` files, with multi-select enabled

#### Scenario: Non-FIT file rejected
- **WHEN** user drops or selects a file that is not a `.fit` file
- **THEN** the file is rejected with a visible error message and not added to the queue

### Requirement: Batch import with progress
The system SHALL process queued files sequentially and show per-file import status.

#### Scenario: Import button triggers batch processing
- **WHEN** user clicks "Import" and the queue has files
- **THEN** each file is parsed and stored one at a time, with the current file's status updating through "parsing" → "importing" → "imported" (or "error")

#### Scenario: Progress indicators
- **WHEN** a batch import is in progress
- **THEN** each file in the queue shows a status badge (queued/parsing/importing/imported/error/duplicate) and overall progress shows X of Y files complete

#### Scenario: Partial failure
- **WHEN** some files in a batch fail to parse
- **THEN** successful files are imported and failed files show an error message with the reason, while the batch continues processing remaining files

### Requirement: Import page navigation
The system SHALL add a navigation link to the import page in the app's nav bar.

#### Scenario: Nav link visible
- **WHEN** user views the app navigation
- **THEN** an "Import" link is present that navigates to `/import`

### Requirement: Show imported activities in activity list
The system SHALL display device-imported activities alongside Strava activities in the existing activity list with a source indicator badge.

#### Scenario: Imported activity appears in list
- **WHEN** a FIT file has been successfully imported
- **THEN** the activity appears in the `/activities` list with a "Device" badge distinguishing it from Strava-sourced activities
