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
1. Click on your user profile icon in the top-right
2. Select "Share Cards" from the dropdown menu
3. Enter the email address of the user you want to share with
4. Click "Add" to add them to your sharing list

### Managing Shared Users
- View all users you're currently sharing with
- Remove users from your sharing list by clicking the delete icon
- Users are validated to ensure:
  - Valid email format
  - Not sharing with yourself
  - No duplicate entries

## Important Notes

### Current Limitation
Due to Firestore's architecture, the current implementation focuses on managing **who you share with**. To fully implement bidirectional sharing (viewing cards shared with you), you would need:

1. **Option A: Cloud Functions (Recommended)**
   - Create a Cloud Function that triggers when a user adds someone to their `shared_with` collection
   - The function creates a corresponding entry in the target user's `sharing_with_me` collection
   - This allows efficient querying of shared cards

2. **Option B: Firestore Security Rules**
   - Update security rules to allow users to read cards from users who have shared with them
   - Query each sharing user's cards collection individually

### Example Cloud Function (for Option A)
```typescript
// Firebase Cloud Function example
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

export const onSharedWithAdded = functions.firestore
  .document('users/{userId}/shared_with/{sharedUserId}')
  .onCreate(async (snap, context) => {
    const { userId } = context.params;
    const sharedData = snap.data();
    const sharedEmail = sharedData.email;
    
    // Find the user with this email
    const usersSnapshot = await admin.firestore()
      .collection('users')
      .where('email', '==', sharedEmail)
      .limit(1)
      .get();
    
    if (!usersSnapshot.empty) {
      const targetUserId = usersSnapshot.docs[0].id;
      
      // Add to their sharing_with_me collection
      await admin.firestore()
        .doc(`users/${targetUserId}/sharing_with_me/${userId}`)
        .set({
          userId: userId,
          email: sharedData.email,
          addedAt: sharedData.addedAt
        });
    }
  });
```

## Future Enhancements

1. **Implement Cloud Functions** for automatic bidirectional sync
2. **Add notification system** when someone shares cards with you
3. **Granular sharing controls** (share specific cards instead of all)
4. **Share groups** for sharing with multiple users at once
5. **Expiring shares** with automatic removal after a set time
6. **Two-way acceptance** where the recipient must accept the share

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
  id: string;
  email: string;
  addedAt: Date;
}

export interface CardContent {
  id: string;
  store_name: string;
  code: string;
  barcode_type?: BarcodeType;
  shop_locations: ShopLocation[] | null;
  ownerEmail?: string; // Optional: shows who owns shared cards
  ownerId?: string;    // Optional: identifies the card owner
}
```
