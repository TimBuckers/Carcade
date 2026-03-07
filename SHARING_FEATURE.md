# Card Sharing Feature

## Overview
Users can now share all their customer cards with other users by email. This feature uses a new Firestore collection structure.

## Firestore Structure

### Collections

#### 1. User's Cards Collection
```
users/{userId}/customer_cards/{cardId}
```
- Contains all cards owned by a specific user
- Fields: `store_name`, `code`, `barcode_type`, `shop_locations`

#### 2. Shared With Collection (NEW)
```
users/{userId}/shared_with/{sharedUserId}
```
- Contains the list of users with whom the current user wants to share their cards
- Fields:
  - `email` (string): Email address of the user to share with
  - `addedAt` (timestamp): When this user was added to the sharing list

## How It Works

### Sharing Your Cards
1. Click on your user profile icon in the top-right.
2. Select **Share Cards** from the dropdown menu.
3. Enter the email address of the other CardCade user you want to share with.
4. Click **Add** — the app looks up their profile by email and immediately grants access.

### Managing Shared Users
- View all users you're currently sharing with.
- Remove users from your sharing list by clicking the delete icon — access is revoked immediately.
- Users are validated to ensure:
  - Valid email format
  - Not sharing with yourself
  - No duplicate entries
  - Email matches an existing CardCade account

## Implementation Details

### Bidirectional Reverse Index (No Cloud Functions Required)

The app maintains a **bidirectional reverse index** entirely in Firestore, without any Cloud Functions.

When **User A shares with User B**, the app atomically writes two documents:

```
users/{userA_uid}/shared_with/{userB_uid}
  { email: userB@..., userId: userB_uid, addedAt }

users/{userB_uid}/sharing_with_me/{userA_uid}
  { email: userA@..., userId: userA_uid, addedAt }
```

When **User A removes User B**, both documents are deleted together:

```typescript
// SharedUsersManager.tsx — handleRemoveUser()
await deleteDoc(doc(db, `users/${userA}/shared_with/${userB}`));
await deleteDoc(doc(db, `users/${userB}/sharing_with_me/${userA}`));
```

### Fetching Cards (cardService.ts)

1. Fetch own cards from `users/{userId}/{COLLECTION}`.
2. Read `users/{userId}/sharing_with_me/` to get all users who share with the current user.
3. For each sharing user, fetch their card collection (Firestore security rules allow this because the `sharing_with_me` entry exists).
4. Shared cards are merged with own cards and sorted by `openCount` descending.

## Future Enhancements

1. **Add notification / badge** when someone new shares cards with you
2. **Granular sharing controls** (share specific cards instead of all)
3. **Share groups** for sharing with multiple users at once
4. **Expiring shares** with automatic removal after a set time
5. **Two-way acceptance** where the recipient must accept the share
6. **Offline support for shared cards** (IndexedDB caching of shared card data)

## Firestore Security Rules

Update your `firestore.rules` to include:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // User's own cards
    match /users/{userId}/customer_cards/{cardId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // User's shared_with list
    match /users/{userId}/shared_with/{sharedId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Optional: Allow reading sharing_with_me collection
    match /users/{userId}/sharing_with_me/{sharerId} {
      allow read: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## Type Definitions

New types added to `src/types.ts`:

```typescript
export interface SharedUser {
  id: string;     // Firebase UID of the user being shared with
  email: string;
  addedAt: Date;
}

export interface CardContent {
  id: string;
  store_name: string;
  code: string;
  barcode_type?: BarcodeType;
  shop_locations: ShopLocation[] | null;
  openCount?: number;    // Atomic counter — incremented each time the card is opened
  ownerEmail?: string;   // Set on shared cards; shows who owns them
  ownerId?: string;      // UID of the card owner; present on shared cards
}
```
