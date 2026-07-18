# PiPlate synchronization foundation

PiPlate currently keeps recipes, the weekly plan, and settings in IndexedDB on one device. Cross-device synchronization must preserve that offline behavior while treating a household cloud dataset as the shared source of truth.

## Data boundary

- A signed-in user belongs to one household.
- Recipes and planner state are scoped to the household, not to a device.
- IndexedDB remains the offline cache and pending-change queue.
- Uploaded recipe pictures are stored as files, not embedded in synchronized recipe documents.

## Shared records

- `households/{householdId}`: name, members, created and updated timestamps.
- `households/{householdId}/recipes/{recipeId}`: recipe fields, image reference, revision, updated timestamp, and deletion tombstone.
- `households/{householdId}/planner/{weekId}`: the seven-day recipe-ID lists, revision, and updated timestamp.
- `households/{householdId}/settings/shared`: household-wide preferences that affect shared data. The planner day sequence is derived from each device's current local day and is not synchronized.

## Required behavior

1. The first device uploads its existing local recipes and planner only after the user confirms the initial merge.
2. A joining device downloads the household dataset without adding starter recipes or overwriting cloud records with its defaults.
3. Local edits are written to IndexedDB first, queued, and retried when online.
4. Server timestamps and revisions resolve concurrent edits. Conflicts retain both versions until the user chooses one.
5. Deletes synchronize as tombstones so deleted recipes do not return from another offline device.
6. Planner references to deleted recipes are removed atomically.
7. Images use private household storage with authenticated access and upload size limits.

## Recommended implementation

Use Firebase Authentication, Cloud Firestore, Cloud Storage, and App Check. This supports Android Chrome and iPhone Safari from the existing PWA while keeping access rules tied to household membership. No Firebase project credentials or user tokens belong in GitHub.

Before enabling the feature, create the Firebase project, configure the two production origins (`shakesbird.github.io` and the local development origin), enable authentication, and deploy reviewed Firestore and Storage security rules.
