# Firestore Security Rules for Card Sharing (Optimized)

## Complete Security Rules

Update your `firestore.rules` file with the following:

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    
    // User's profile document
    match /users/{userId}/profile/info {
      // Users can read and write their own profile
      allow read, write: if request.auth != null && request.auth.uid == userId;
      
      // Allow reading any profile when searching by email (for sharing feature)
      // This is needed for the collectionGroup query when adding users to share with
      allow read: if request.auth != null;
    }
    
    // User's customer cards
    match /users/{userId}/customer_cards/{cardId} {
      // Users can read their own cards
      // OR cards from users who have shared with them (checked via sharing_with_me collection)
      allow read: if request.auth != null && 
                    (request.auth.uid == userId || 
                     exists(/databases/$(database)/documents/users/$(request.auth.uid)/sharing_with_me/$(userId)));
      
      // Users can only write (create, update, delete) their own cards
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // User's shared_with collection (who they share their cards with)
    match /users/{userId}/shared_with/{sharedUserId} {
      // Users can read and manage their own sharing list
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // User's sharing_with_me collection (who is sharing cards with them)
    match /users/{userId}/sharing_with_me/{sharerUserId} {
      // Users can read their own sharing_with_me list
      allow read: if request.auth != null && request.auth.uid == userId;
      
      // Only the sharer can write to this collection (when they add/remove you)
      allow write: if request.auth != null && request.auth.uid == sharerUserId;
    }
  }
}
```

## How the Security Rules Work

### 1. **Profile Access**
- Users can read and write their own profile
- **Any authenticated user can read profiles** (needed for the sharing feature to find users by email)
- This is safe because profiles only contain email and username

### 2. **Customer Cards Access**
- Users can **read** cards if:
  - They own the cards, OR
  - The card owner's UID exists in the current user's `sharing_with_me` collection
- Users can only **write** (create/update/delete) their own cards

### 3. **Shared With Collection**
- Users can only read and write their own `shared_with` list
- Tracks who you are sharing your cards with

### 4. **Sharing With Me Collection (Reverse Index)**
- Users can read their own `sharing_with_me` list
- Only the sharing user can write to this collection
- This prevents manual manipulation and ensures bidirectional sync

## How Sharing Works (Bidirectional Index)

### When User A shares with User B:

1. **Adding a share:**
   - User A enters User B's email
   - App queries profiles to find User B's UID
   - Creates two documents:
     - `users/{userA_uid}/shared_with/{userB_uid}` - "I'm sharing with B"
     - `users/{userB_uid}/sharing_with_me/{userA_uid}` - "A is sharing with me"
   - Both documents contain: `{ email, userId, addedAt }`

2. **User B viewing shared cards:**
   - App fetches User B's own cards
   - App reads `users/{userB_uid}/sharing_with_me/` collection (fast!)
   - For each entry, fetches that user's cards
   - Security rule allows this because `sharing_with_me/{userA_uid}` exists

3. **Removing a share:**
   - User A clicks remove
   - Deletes both documents:
     - `users/{userA_uid}/shared_with/{userB_uid}`
     - `users/{userB_uid}/sharing_with_me/{userA_uid}`

### Document Structure:

```
users/
  {userA_uid}/
    profile/
      info: { email, username?, createdAt, updatedAt }
    customer_cards/
      {cardId}: { store_name, code, barcode_type, shop_locations }
    shared_with/
      {userB_uid}: { email, userId, addedAt }
  
  {userB_uid}/
    profile/
      info: { email, username?, createdAt, updatedAt }
    customer_cards/
      {cardId}: { store_name, code, barcode_type, shop_locations }
    sharing_with_me/
      {userA_uid}: { email, userId, addedAt }
```

## Performance Benefits

### ❌ Old Approach (Inefficient):
```javascript
// Had to fetch ALL users to check sharing
const usersSnapshot = await getDocs(collection(db, 'users')); // 😱
for (const userDoc of usersSnapshot.docs) {
  // Check each user's shared_with collection...
}
```
**Problem:** If you have 10,000 users, you'd fetch 10,000 documents even if only 2 people share with you!

### ✅ New Approach (Efficient):
```javascript
// Only fetch users who are sharing with you
const sharingSnapshot = await getDocs(
  collection(db, `users/${currentUserId}/sharing_with_me`)
); // 🚀
```
**Benefit:** If 2 people share with you, you only fetch 2 documents + their cards!

## Important Notes

### Security Considerations

1. **Profile visibility**: Profiles are readable by all authenticated users for the sharing feature
2. **Card privacy**: Cards are only visible to the owner and explicitly shared users
3. **One-way sharing**: Sharing is not mutual - if A shares with B, B does NOT automatically share with A
4. **Tamper-proof**: Users cannot manually add entries to their `sharing_with_me` collection (security rule prevents this)

### Data Consistency

The app maintains **bidirectional consistency**:
- When adding: Both `shared_with` and `sharing_with_me` are created
- When removing: Both documents are deleted
- If one operation fails, the other might succeed (eventual consistency trade-off)

For production, consider using **Firebase Cloud Functions** to ensure atomic operations.

## Testing the Rules

You can test these rules in the Firebase Console:

1. Go to Firestore Database → Rules
2. Click "Rules Playground"
3. Test scenarios:
   - User A reading their own cards ✓
   - User B reading User A's cards (after A shares with B) ✓
   - User C reading User A's cards (without sharing) ✗
   - User B writing to User A's cards ✗
   - User B manually adding to their own `sharing_with_me` ✗
   - User A adding to User B's `sharing_with_me` ✓
