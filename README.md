# CardCade - Customer Card Manager

CardCade is a React-based customer card management application with barcode scanning capabilities and location-based shop selection. The app allows users to store and manage customer loyalty cards with smart features for finding the closest relevant shop.

## Features

- 📱 **Barcode Scanning**: Scan customer cards using your device's camera
- 🎰 **Magic Click**: Click the logo to automatically select the closest shop based on your location
- 🗺️ **Location-Based Selection**: Uses hardcoded shop coordinates to find nearby shops and match them with your cards
- 🔥 **Firebase Integration**: Cloud storage for all your customer cards
- 📱 **Responsive Design**: Works on mobile and desktop devices
- 🎨 **Material Design**: Clean, modern UI with Material-UI components

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

1. **Add Cards**: Click "Add Card" to scan or manually enter customer card information
   - **Shop Locations**: Expand the "Shop Locations" section to add GPS coordinates for shop locations
   - **Multiple Locations**: Add multiple locations for chains with multiple stores
   - **Coordinates**: Find coordinates using Google Maps by clicking on a location

2. **Magic Click**: Click the CardCade logo to find the closest shop and display its card

3. **View Cards**: Browse all your stored cards in the responsive grid layout

4. **Card Details**: Click any card to view its full details and barcode

## Adding Shop Locations

When adding a new card, you can specify one or more shop locations:

1. Expand the "Shop Locations" accordion in the add card form
2. Enter latitude and longitude coordinates for each shop location
3. Add multiple locations for chains (e.g., different McDonald's locations)
4. Use Google Maps to find coordinates:
   - Search for the shop on Google Maps
   - Click on the location to get coordinates
   - Copy the coordinates to the form

Example coordinates:
- **New York City**: 40.7128, -74.0060
- **Los Angeles**: 34.0522, -118.2437
- **London**: 51.5074, -0.1278

## Technical Stack

- **Frontend**: React 18 + TypeScript + Vite
- **UI Library**: Material-UI (MUI)
- **Backend**: Firebase Firestore
- **Barcode Scanning**: Quagga2
- **Location Services**: Browser Geolocation API
- **Deployment**: Firebase Hosting

## Architecture

```
src/
├── components/
│   ├── AddCardForm.tsx    # Card input form with barcode scanning and location management
│   └── CardList.tsx       # Card display grid with modal
├── utils/
│   └── magicClick.ts      # Location-based shop selection logic
├── types.ts               # TypeScript type definitions including ShopLocation
├── firebase.ts            # Firebase configuration
└── App.tsx               # Main application component
```

## Data Structure

Each customer card now includes shop locations:

```typescript
interface CardContent {
  id: string;
  store_name: string;
  code: string;
  barcode_type: string;
  shop_locations: ShopLocation[];
}

interface ShopLocation {
  lat: number;
  lng: number;
}
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
