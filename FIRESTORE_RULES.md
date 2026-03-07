# Firestore Security Rules for Card Sharing

> These rules match the current `firestore.rules` file in the repository.
> For a full explanation of the performance rationale see [FIRESTORE_RULES_OPTIMIZED.md](./FIRESTORE_RULES_OPTIMIZED.md).

## Complete Security Rules

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    
    // User's profile document
    match /users/{userId}/profile/info {
      // Users can read and write their own profile
      allow read, write: if request.auth != null && request.auth.uid == userId;
      
      // Any authenticated user can read profiles (needed to look up users by email
      // when adding them to a sharing list)
      allow read: if request.auth != null;
    }
    
    // Allow collectionGroup query on all profile subcollections
    match /{path=**}/profile/{document} {
      allow read: if request.auth != null;
    }

    // User's customer cards
    match /users/{userId}/customer_cards/{cardId} {
      // Users can read their own cards
      // OR cards from a user who has added the current user to their sharing list
      // (checked via the current user's sharing_with_me reverse index — O(1) lookup)
      allow read: if request.auth != null && 
                    (request.auth.uid == userId || 
                     exists(/databases/$(database)/documents/users/$(request.auth.uid)/sharing_with_me/$(userId)));
      
      // Users can only write (create, update, delete) their own cards
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // User's shared_with collection (the list of users this user shares with)
    match /users/{userId}/shared_with/{sharedUserId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // User's sharing_with_me collection (reverse index: who is sharing with this user)
    match /users/{userId}/sharing_with_me/{sharerUserId} {
      // Users can read their own sharing_with_me list
      allow read: if request.auth != null && request.auth.uid == userId;
      
      // Only the sharer (sharerUserId) can write to this collection
      // This prevents users from falsely granting themselves access to others' cards
      allow write: if request.auth != null && request.auth.uid == sharerUserId;
    }
  }
}
```

## How the Security Rules Work

### 1. Profile Access
- Users can read and write their own profile.
- Any authenticated user can read **any** profile — required so the app can look up a user by email when adding them to a sharing list (via a `collectionGroup` query).
- Profiles only contain `email` and an optional `username`, so broad read access is safe.

### 2. Customer Card Access
- Users can **read** cards if:
  - They own the cards (`request.auth.uid == userId`), **or**
  - The card owner's UID appears in the current user's `sharing_with_me` collection (i.e., the owner explicitly chose to share).
- Users can only **write** (create / update / delete) their own cards.

### 3. `shared_with` Collection
- Each user fully controls their own `shared_with` list (read + write).
- Document ID = the target user's Firebase UID.
- Contains: `{ email, userId, addedAt }`.

### 4. `sharing_with_me` Collection (Reverse Index)
- Each user can read their own `sharing_with_me` list.
- Only the **sharer** (`sharerUserId`) can write to another user's `sharing_with_me`.
  This blocks users from manually granting themselves access to foreign cards.

## How Sharing Works

### Adding a Share (User A → User B)
1. User A enters User B's email.
2. App looks up User B's UID via a `collectionGroup` query on `profile`.
3. App writes **two** Firestore documents atomically from the client:
   - `users/{A}/shared_with/{B}` — "I am sharing with B"
   - `users/{B}/sharing_with_me/{A}` — "A is sharing with me" (reverse index)

### Viewing Shared Cards (User B's perspective)
1. App reads `users/{B}/sharing_with_me/` — a small collection, O(sharers) reads.
2. For each entry, fetches that user's card collection.
3. Security rules allow this because `sharing_with_me/{A}` exists.

### Removing a Share
1. User A clicks **Remove** next to User B.
2. App deletes **both** documents:
   - `users/{A}/shared_with/{B}`
   - `users/{B}/sharing_with_me/{A}`
3. User B immediately loses access (rule check fails on next Firestore read).

### Document Structure

```
users/
  {userA_uid}/
    profile/
      info: { email, username?, createdAt, updatedAt }
    customer_cards/
      {cardId}: { store_name, code, barcode_type, shop_locations, openCount }
    shared_with/
      {userB_uid}: { email, userId, addedAt }

  {userB_uid}/
    sharing_with_me/
      {userA_uid}: { email, userId, addedAt }
```

## Security Considerations

1. **Profile visibility**: Profiles are readable by all authenticated users — kept intentionally minimal (email + optional username).
2. **Card privacy**: Cards are visible only to the owner and explicitly added recipients.
3. **One-way sharing**: If A shares with B, B does **not** automatically share back with A.
4. **Tamper-proof reverse index**: Only the sharer can write to a recipient's `sharing_with_me` collection.

## Testing the Rules

1. Go to Firestore Database → Rules in the Firebase Console.
2. Click **Rules Playground**.
3. Verify scenarios:
   - User A reading their own cards ✓
   - User B reading User A's cards after A shares with B ✓
   - User C reading User A's cards without sharing ✗
   - User B writing to User A's cards ✗
   - User B adding themselves to their own `sharing_with_me` without being the sharer ✗
