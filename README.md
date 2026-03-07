# CardCade - Customer Card Manager

CardCade is a React-based customer card management application with barcode scanning capabilities and location-based shop selection. The app allows users to store and manage customer loyalty cards with smart features for finding the closest relevant shop.

## Features

- � **Authentication**: Sign in securely with Google
- 📱 **Barcode & QR Scanning**: Scan loyalty cards using your device's camera (EAN-13, Code128, Code39, QR)
- 🎰 **Magic Click**: Click the logo to automatically select the card for the closest shop based on your GPS location
- 🗺️ **Location-Based Selection**: Attach GPS coordinates to cards so the closest shop is always surfaced first
- 🤝 **Card Sharing**: Share all your cards with other users by email — bidirectional access, no Cloud Functions required
- 👤 **User Profiles**: Set a custom username visible across the app
- 📊 **Smart Sorting**: Cards are sorted by open count so your most-used cards appear first
- 🔥 **Firebase Integration**: Cloud storage with per-user Firestore collections
- 📱 **Responsive Design**: Works on mobile and desktop devices
- 🎨 **Material Design**: Clean, modern UI with Material-UI v7 components
- 💾 **Progressive Web App (PWA)**: Install on Android and iOS devices, works offline with service worker caching

## PWA Features

CardCade is a fully-featured Progressive Web App that can be installed on both Android and iOS devices:

### Installation

**Android (Chrome/Edge):**
1. Open the app in Chrome or Edge
2. Tap the menu (three dots) and select "Install app" or "Add to Home Screen"
3. The app will be installed and can be launched from your home screen

**iOS (Safari):**
1. Open the app in Safari
2. Tap the Share button (square with arrow)
3. Scroll down and tap "Add to Home Screen"
4. Tap "Add" to confirm
5. The app will appear on your home screen

### Offline Support

The PWA includes a service worker that caches resources for offline use:
- All app assets (JS, CSS, images) are cached after first visit
- Cards and data are stored in Firebase, which has its own offline persistence
- Google Fonts are cached for consistent styling offline

### PWA Benefits

- **Fast Loading**: Cached assets load instantly
- **Offline Access**: Core functionality works without internet
- **Native-like Experience**: Runs in standalone mode without browser UI
- **Auto-updates**: New versions are automatically downloaded and activated
- **Responsive**: Adapts to any screen size and orientation

## Magic Click Feature

The "Magic Click" feature uses your device's GPS location to:
1. Get your current position
2. Calculate distances to all shop locations stored with your cards
3. Find the closest shop location
4. Automatically select and display the card for the closest shop
5. Fall back to random selection if no shop locations are available

## Setup and Installation

### Prerequisites

- Node.js 20.19+ or 22.12+
- A Firebase project

### Environment Configuration

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Configure your environment variables in `.env`:

#### Firebase Configuration
```env
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef123456
VITE_FIRESTORE_COLLECTION=customer_cards
VITE_APP_NAME=CardCade
```

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Build for production:
   ```bash
   npm run build
   ```

4. Deploy to Firebase Hosting:
   ```bash
   firebase deploy --only hosting
   ```

## Usage

1. **Sign In**: Log in with your Google account on first launch.

2. **Add Cards**: Click **+ Card** in the toolbar to open the add-card form.
   - Enter the store name and barcode/QR value manually, or tap **Scan** to use your camera.
   - Select the barcode type (EAN-13, Code128, Code39, or QR Code).
   - Click **Add Card** to save to Firestore.

3. **Attach Shop Locations**: Open any card, then click the **location pin icon** to open the Location Dialog.
   - Tap **Use Current Location** to capture your GPS position as a shop coordinate.
   - Add multiple coordinates for chain stores with multiple branches.
   - Remove all coordinates with **Clear All Locations**.

4. **Magic Click**: Click the CardCade logo on the main screen.
   - The app requests your GPS position, calculates distances to all stored shop coordinates, and opens the card for the closest match.
   - Falls back to a random card if no shop coordinates exist.

5. **View Cards**: Cards are displayed in a responsive grid sorted by open count (most-used first). Click any card to view its barcode/QR code in full.

6. **Share Cards**: Open the user menu (top-right avatar) → **Share Cards**.
   - Enter the email address of another CardCade user.
   - Their email must match an existing account profile.
   - All your cards will be visible to them immediately; shared cards show your email as the owner.
   - Remove a user to revoke access instantly.

7. **User Profile**: Open the user menu → **Profile** to set a custom username.

## Technical Stack

- **Frontend**: React 19 + TypeScript + Vite 7
- **UI Library**: Material-UI (MUI) v7
- **Backend**: Firebase 12 (Firestore + Auth)
- **Authentication**: Firebase Google Sign-In
- **Barcode Scanning**: Quagga2 (Code128, EAN-13, Code39)
- **Barcode Rendering**: JsBarcode + qr-code-styling (QR codes)
- **Location Services**: Browser Geolocation API
- **PWA**: vite-plugin-pwa with Workbox
- **Service Worker**: Auto-updating with runtime caching
- **Testing**: Vitest
- **Deployment**: Firebase Hosting

## Architecture

```
src/
├── components/
│   ├── AddCardForm.tsx        # Card input form with live barcode scanning
│   ├── CardList.tsx           # Card display grid with modal, barcode/QR rendering, and location editing
│   ├── LoginPage.tsx          # Google Sign-In landing page
│   ├── LocationDialog.tsx     # Dialog for attaching/removing GPS shop coordinates from a card
│   ├── SharedUsersManager.tsx # Manage users you share all your cards with
│   └── UserProfileManager.tsx # Edit display username
├── contexts/
│   └── AuthContext.tsx        # Firebase Auth context (Google provider)
├── services/
│   └── cardService.ts         # Firestore CRUD: fetch own cards, fetch shared cards, add, update locations, increment openCount
├── utils/
│   ├── magicClick.ts          # Magic-click: GPS → closest shop → open card modal
│   ├── geolocation.ts         # getCurrentLocation(), calculateDistance(), duplicate detection
│   ├── firebasePaths.ts       # Centralized Firestore path helpers
│   ├── errorHandler.ts        # Error extraction, validation helpers (email, username)
│   └── logger.ts              # Dev/prod logging wrapper
├── constants/
│   └── index.ts               # Animation, geolocation, UI, validation, scanner constants
├── types.ts                   # TypeScript interfaces: CardContent, ShopLocation, SharedUser, UserProfile
├── firebase.ts                # Firebase app + Firestore initialization
└── App.tsx                    # Root: auth gate, AppBar, card fetching, magic-click handler
```

## Data Structure

```typescript
interface CardContent {
  id: string;
  store_name: string;
  code: string;
  barcode_type?: BarcodeType;       // 'EAN13' | 'EAN8' | 'CODE128' | 'CODE39' | 'QRCODE'
  shop_locations: ShopLocation[] | null;
  openCount?: number;               // Atomic counter incremented each time the card is opened
  ownerEmail?: string;              // Set on shared cards — shows who owns them
  ownerId?: string;                 // UID of the owner; present on shared cards
}

interface ShopLocation {
  lat: number;
  lng: number;
}

interface SharedUser {
  id: string;     // Firebase UID of the user being shared with
  email: string;
  addedAt: Date;
}

interface UserProfile {
  email: string;
  username?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
```

### Firestore Layout

```
users/
  {userId}/
    profile/
      info: { email, username?, createdAt, updatedAt }
    {VITE_FIRESTORE_COLLECTION}/        # e.g. customer_cards
      {cardId}: { store_name, code, barcode_type, shop_locations, openCount }
    shared_with/
      {targetUserId}: { email, userId, addedAt }  # Who I share with
    sharing_with_me/
      {sharerUserId}: { email, userId, addedAt }  # Who shares with me (reverse index)
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit your changes: `git commit -am 'Add feature'`
4. Push to the branch: `git push origin feature-name`
5. Submit a pull request

## Security Notes

- Never commit your `.env` file to version control
- Configure Firebase security rules appropriately
- Use HTTPS in production for geolocation access
- Be mindful of location privacy when sharing cards
