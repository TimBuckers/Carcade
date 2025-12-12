# Firestore Security Rules for Card Sharing

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
      // OR cards from users who have shared with them (the user's ID exists in owner's shared_with)
      allow read: if request.auth != null && 
                    (request.auth.uid == userId || 
                     exists(/databases/$(database)/documents/users/$(userId)/shared_with/$(request.auth.uid)));
      
      // Users can only write (create, update, delete) their own cards
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // User's shared_with collection (who they share their cards with)
    match /users/{userId}/shared_with/{sharedUserId} {
      // Users can read and manage their own sharing list
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Top-level users collection (for listing users when checking shared cards)
    match /users/{userId} {
      // Allow reading user document metadata (needed for fetchCards to iterate users)
      allow read: if request.auth != null;
      
      // Only allow writing your own user document
      allow write: if request.auth != null && request.auth.uid == userId;
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
  - The card owner has a document with the current user's ID in their `shared_with` collection
- Users can only **write** (create/update/delete) their own cards

### 3. **Shared With Collection**
- Users can only read and write their own `shared_with` list
- The document ID is the shared user's UID (not email)

### 4. **Users Collection**
- Any authenticated user can read user document metadata
- This allows the app to iterate through users to check sharing relationships
- Users can only write their own user document

## How Sharing Works

### When User A shares with User B:

1. **Adding a share:**
   - User A enters User B's email
   - App queries profiles to find User B's UID
   - Creates document: `users/{userA_uid}/shared_with/{userB_uid}`
   - Document contains: `{ email, userId, addedAt }`

2. **User B viewing shared cards:**
   - App fetches User B's own cards
   - App iterates through all users
   - For each user, checks if `users/{otherUser_uid}/shared_with/{userB_uid}` exists
   - If yes, fetches that user's cards (security rule allows this)

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
```

## Important Notes

### Performance Considerations

The current implementation iterates through all users to check sharing relationships. For better performance in production:

1. **Use Cloud Functions** to maintain a reverse index:
   - When `users/{A}/shared_with/{B}` is created
   - Also create `users/{B}/sharing_with_me/{A}`
   - This avoids iterating all users

2. **Limit user queries** with pagination or caching

### Security Considerations

1. **Profile visibility**: Profiles are readable by all authenticated users for the sharing feature
2. **Card privacy**: Cards are only visible to the owner and explicitly shared users
3. **One-way sharing**: Sharing is not mutual - if A shares with B, B does NOT automatically share with A

### Future Enhancements

1. Add Cloud Functions for reverse indexing
2. Add notification when someone shares cards with you
3. Add ability to accept/reject shares
4. Add sharing analytics (who viewed your cards)
5. Add granular sharing (share specific cards, not all)

## Testing the Rules

You can test these rules in the Firebase Console:

1. Go to Firestore Database → Rules
2. Click "Rules Playground"
3. Test scenarios:
   - User A reading their own cards ✓
   - User B reading User A's cards (after A shares with B) ✓
   - User C reading User A's cards (without sharing) ✗
   - User B writing to User A's cards ✗
