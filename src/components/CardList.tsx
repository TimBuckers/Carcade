import JsBarcode from 'jsbarcode';
import QRCodeStyling from 'qr-code-styling';
import type { JSX } from 'react/jsx-runtime';
import { type CardContent, BarcodeTypes, type ShopLocation } from '../types';
import { doc, updateDoc } from "firebase/firestore";
import { db } from '../firebase';
import {
  Card,
  CardContent as MuiCardContent,
  Typography,
  Box,
  Chip,
  Modal,
  IconButton,
  Tooltip,
  Snackbar,
  Alert
} from '@mui/material';
import { CreditCard, Close, LocationOn } from '@mui/icons-material';
import { useState } from 'react';


interface CardListProps {
  cards: CardContent[];
  onCardUpdated: () => void;
}

function CardList({ cards, onCardUpdated }: CardListProps) {
  const [selectedCard, setSelectedCard] = useState<CardContent | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState<boolean>(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string>('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');

  const getBarcodeORQRImage = (code: string, barcodeType: keyof typeof BarcodeTypes): JSX.Element | null => {
    if (barcodeType === 'QRCODE') {
        // For QR codes, create a div container that QRCodeStyling can render into
        const qrCode = new QRCodeStyling({
            width: 200,
            height: 200,
            data: code,
            image: undefined,
            dotsOptions: {
                color: "#000",
            },
            backgroundOptions: {
                color: "#fff",
            },
            imageOptions: {
                hideBackgroundDots: true,
                imageSize: 0.4,
                margin: 0
            }
        });
        
        // Create a unique ID for this QR code
        const qrId = `qr-${Math.random().toString(36).substr(2, 9)}`;
        
        // Use setTimeout to ensure the element exists before rendering
        setTimeout(() => {
            const element = document.getElementById(qrId);
            if (element) {
                element.innerHTML = ''; // Clear any existing content
                qrCode.append(element);
            }
        }, 0);
        
        return <div id={qrId} style={{ display: 'inline-block' }} />;
    }

    // For regular barcodes, use JsBarcode as before
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    try {
        JsBarcode(canvas, code, {
            format: BarcodeTypes[barcodeType],
            displayValue: true,
            width: 2,
            height: 100
        });
        return <img src={canvas.toDataURL("image/png")} alt={`Barcode for ${code}`} />;
    } catch (error) {
        console.error('Error generating barcode:', error);
        return <div>Error generating barcode</div>;
    }
  };

  // Function to get current location
  const getCurrentLocation = (): Promise<{ lat: number; lng: number }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by this browser'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          reject(new Error(`Geolocation error: ${error.message}`));
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // 5 minutes
        }
      );
    });
  };

  // Function to add current location to card's shop_locations
  const addCurrentLocationToCard = async (card: CardContent, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent card modal from opening
    
    try {
      // Get current location
      const currentLocation = await getCurrentLocation();
      
      // Get existing shop_locations or create empty array
      const existingLocations: ShopLocation[] = card.shop_locations || [];
      
      // Check if this location already exists (within 100m radius)
      const locationExists = existingLocations.some(location => {
        const distance = calculateDistance(
          currentLocation.lat, 
          currentLocation.lng, 
          location.lat, 
          location.lng
        );
        return distance < 0.1; // Less than 100 meters
      });
      
      if (locationExists) {
        setSnackbarMessage('This location is already saved for this card');
        setSnackbarSeverity('error');
        setSnackbarOpen(true);
        return;
      }
      
      // Add new location to the array
      const updatedLocations = [...existingLocations, currentLocation];
      
      // Update the document in Firestore
      const cardRef = doc(db, import.meta.env.VITE_FIRESTORE_COLLECTION, card.id);
      await updateDoc(cardRef, {
        shop_locations: updatedLocations
      });
      
      setSnackbarMessage(`Location added to ${card.store_name}!`);
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
      
      // Refresh the card list
      onCardUpdated();
      
    } catch (error) {
      console.error('Error adding location:', error);
      setSnackbarMessage('Failed to add location. Please try again.');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };

  // Helper function to calculate distance between two points (Haversine formula)
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLng = (lng2 - lng1) * (Math.PI / 180);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  return (
    <Box sx={{ mt: 3 }}>
      <Typography variant="h5" component="h2" gutterBottom sx={{ ml: 2 }}>
        Your Customer Cards
      </Typography>
      <Box sx={{ p: 2 }}>
        {cards.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="body1" color="text.secondary">
              No cards added yet. Add your first customer card above!
            </Typography>
          </Box>
        ) : (
          <Box sx={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', 
            gap: 2 
          }}>
            {cards.map(card => (
              <Card 
                key={card.id}
                data-card-id={card.id}
                elevation={3}
                onClick={() => setSelectedCard(card)}
                sx={{ 
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  cursor: 'pointer',
                  position: 'relative',
                  '&:hover': {
                    boxShadow: 6,
                    transform: 'translateY(-2px) scale(1.02)',
                    transition: 'all 0.3s ease-in-out'
                  },
                  '&:active': {
                    transform: 'scale(0.98)',
                    transition: 'all 0.1s ease-in-out'
                  }
                }}
              >
                {/* Location Icon */}
                <Tooltip title={`Add current location to ${card.store_name}`}>
                  <IconButton
                    onClick={(e) => addCurrentLocationToCard(card, e)}
                    sx={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      zIndex: 1,
                      backgroundColor: 'rgba(255, 255, 255, 0.9)',
                      color: card.shop_locations && card.shop_locations.length > 0 ? 'success.main' : 'action.disabled',
                      '&:hover': {
                        backgroundColor: 'rgba(255, 255, 255, 1)',
                        color: 'primary.main',
                        transform: 'scale(1.1)',
                      }
                    }}
                    size="small"
                  >
                    <LocationOn />
                  </IconButton>
                </Tooltip>

                <MuiCardContent sx={{ flexGrow: 1, p: 2, pt: 5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <CreditCard sx={{ mr: 1, color: 'primary.main' }} />
                    <Typography variant="h6" component="h3" noWrap>
                      {card.store_name}
                    </Typography>
                    {card.shop_locations && card.shop_locations.length > 0 && (
                      <Chip 
                        label={`${card.shop_locations.length} location${card.shop_locations.length > 1 ? 's' : ''}`}
                        size="small" 
                        color="success"
                        sx={{ ml: 1, fontSize: '0.7rem' }}
                      />
                    )}
                  </Box>
                  
                  <Box sx={{ textAlign: 'center', mb: 2 }}>
                    {card.barcode_type && getBarcodeORQRImage(card.code, card.barcode_type)}
                  </Box>
                  
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                      {card.code}
                    </Typography>
                    <Chip 
                      label={card.barcode_type} 
                      size="small" 
                      variant="outlined" 
                      color="primary"
                    />
                  </Box>
                </MuiCardContent>
              </Card>
            ))}
          </Box>
        )}
      </Box>
      
      {/* Enlarged Card Modal */}
      <Modal
        open={selectedCard !== null}
        onClose={() => setSelectedCard(null)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: { xs: 1, sm: 2 }
        }}
      >
        <Box
          sx={{
            position: 'relative',
            maxWidth: '90vw',
            maxHeight: '90vh',
            outline: 'none',
            animation: selectedCard ? 'zoomIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'none',
            '@keyframes zoomIn': {
              '0%': {
                transform: 'scale(0.3) rotate(-10deg)',
                opacity: 0,
              },
              '50%': {
                transform: 'scale(1.1) rotate(2deg)',
                opacity: 0.8,
              },
              '100%': {
                transform: 'scale(1) rotate(0deg)',
                opacity: 1,
              }
            }
          }}
        >
          {selectedCard && (
            <Card 
              elevation={12}
              sx={{
                width: '100%',
                maxWidth: { xs: '90vw', sm: '90vw', md: 600 },
                minWidth: { xs: '280px', sm: '350px', md: '400px' },
                position: 'relative',
                background: 'linear-gradient(135deg, #ffffff 0%, #f5f5f5 100%)',
              }}
            >
              <IconButton
                onClick={() => setSelectedCard(null)}
                sx={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  zIndex: 1,
                  backgroundColor: 'rgba(255, 255, 255, 0.9)',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 1)',
                    transform: 'rotate(90deg)',
                    transition: 'all 0.3s ease-in-out'
                  }
                }}
              >
                <Close />
              </IconButton>
              
              <MuiCardContent sx={{ p: 4 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                  <CreditCard sx={{ mr: 2, color: 'primary.main', fontSize: 40 }} />
                  <Typography variant="h4" component="h3" sx={{ fontWeight: 'bold' }}>
                    {selectedCard.store_name}
                  </Typography>
                  {selectedCard.shop_locations && selectedCard.shop_locations.length > 0 && (
                    <Box sx={{ ml: 2, display: 'flex', alignItems: 'center' }}>
                      <LocationOn sx={{ mr: 0.5, color: 'success.main' }} />
                      <Typography variant="body2" color="success.main">
                        {selectedCard.shop_locations.length} location{selectedCard.shop_locations.length > 1 ? 's' : ''}
                      </Typography>
                    </Box>
                  )}
                </Box>
                
                <Box sx={{ 
                  textAlign: 'center', 
                  mb: 3,
                  p: 2,
                  backgroundColor: 'rgba(255, 255, 255, 0.8)',
                  borderRadius: 2,
                  border: '1px dashed #ccc',
                  overflow: 'hidden',
                  maxWidth: '100%'
                }}>
                  <Box sx={{ 
                    maxWidth: '100%',
                    maxHeight: '200px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    '& img': {
                      maxWidth: '100%',
                      maxHeight: '200px',
                      height: 'auto',
                      width: 'auto',
                      objectFit: 'contain'
                    }
                  }}>
                    {selectedCard.barcode_type && getBarcodeORQRImage(selectedCard.code, selectedCard.barcode_type)}
                  </Box>
                </Box>
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 3 }}>
                  <Typography variant="h6" sx={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                    {selectedCard.code}
                  </Typography>
                  <Chip 
                    label={selectedCard.barcode_type} 
                    size="medium" 
                    variant="filled" 
                    color="primary"
                    sx={{ fontWeight: 'bold' }}
                  />
                </Box>
              </MuiCardContent>
            </Card>
          )}
        </Box>
      </Modal>

      {/* Snackbar for notifications */}
      <Snackbar 
        open={snackbarOpen} 
        autoHideDuration={4000} 
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setSnackbarOpen(false)} 
          severity={snackbarSeverity} 
          sx={{ width: '100%' }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default CardList;
