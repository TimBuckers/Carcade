import JsBarcode from 'jsbarcode';
import QRCodeStyling from 'qr-code-styling';
import type { JSX } from 'react/jsx-runtime';
import { type CardContent, BarcodeTypes, type ShopLocation } from '../types';
import { useAuth } from '../contexts/AuthContext';
import LocationDialog from './LocationDialog';
import { UI } from '../constants';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { logger } from '../utils/logger';
import {
  Card,
  CardContent as MuiCardContent,
  Typography,
  Box,
  Chip,
  Modal,
  IconButton,
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
  const { user } = useAuth();
  const [selectedCard, setSelectedCard] = useState<CardContent | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState<boolean>(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string>('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');
  const [locationDialogOpen, setLocationDialogOpen] = useState<boolean>(false);

  const getBarcodeORQRImage = (code: string, barcodeType: keyof typeof BarcodeTypes): JSX.Element | null => {
    if (barcodeType === BarcodeTypes.QRCODE as any) {
        // For QR codes, create a div container that QRCodeStyling can render into
        const qrCode = new QRCodeStyling({
            width: UI.QR_CODE_SIZE,
            height: UI.QR_CODE_SIZE,
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
            width: UI.BARCODE_WIDTH,
            height: UI.BARCODE_HEIGHT
        });
        return <img src={canvas.toDataURL("image/png")} alt={`Barcode for ${code}`} />;
    } catch (error) {
        logger.error('Error generating barcode:', error);
        return <div>Error generating barcode</div>;
    }
  };

  // Function to update locations for selectedCard
  const updateSelectedCardLocations = async (newLocations: ShopLocation[]) => {
    if (!selectedCard || !user) return;
    
    try {
      const userCollection = `users/${user.uid}/${import.meta.env.VITE_FIRESTORE_COLLECTION}`;
      const cardRef = doc(db, userCollection, selectedCard.id);
      await updateDoc(cardRef, {
        shop_locations: newLocations
      });
      
      // Update the selectedCard with new locations
      setSelectedCard({
        ...selectedCard,
        shop_locations: newLocations
      });
      
      onCardUpdated();
      
      setSnackbarMessage(`Locations updated for ${selectedCard.store_name}!`);
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
      
    } catch (error) {
      console.error('Error updating locations:', error);
      setSnackbarMessage('Failed to update locations. Please try again.');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
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
                <MuiCardContent sx={{ flexGrow: 1, p: 2, pt: 5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <CreditCard sx={{ mr: 1, color: 'primary.main' }} />
                    <Typography variant="h6" component="h3" noWrap>
                      {card.store_name}
                    </Typography>
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
                    <Box 
                      sx={{ 
                        ml: 2, 
                        display: 'flex', 
                        alignItems: 'center',
                        cursor: 'pointer',
                        padding: 1,
                        borderRadius: 1,
                        '&:hover': {
                          backgroundColor: 'rgba(76, 175, 80, 0.1)',
                          transform: 'scale(1.05)',
                        },
                        transition: 'all 0.2s ease-in-out'
                      }}
                      onClick={() => setLocationDialogOpen(true)}
                    >
                      <LocationOn sx={{ mr: 0.5, color: 'success.main' }} />
                      <Typography variant="body2" color="success.main">
                        {selectedCard.shop_locations.length} location{selectedCard.shop_locations.length > 1 ? 's' : ''}
                      </Typography>
                    </Box>
                  )}
                  {(!selectedCard.shop_locations || selectedCard.shop_locations.length === 0) && (
                    <Box 
                      sx={{ 
                        ml: 2, 
                        display: 'flex', 
                        alignItems: 'center',
                        cursor: 'pointer',
                        padding: 1,
                        borderRadius: 1,
                        '&:hover': {
                          backgroundColor: 'rgba(255, 152, 0, 0.1)',
                          transform: 'scale(1.05)',
                        },
                        transition: 'all 0.2s ease-in-out'
                      }}
                      onClick={() => setLocationDialogOpen(true)}
                    >
                      <LocationOn sx={{ mr: 0.5, color: 'warning.main' }} />
                      <Typography variant="body2" color="warning.main">
                        Add location
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

      {/* Location Dialog for selectedCard */}
      {selectedCard && (
        <LocationDialog
          open={locationDialogOpen}
          onClose={() => setLocationDialogOpen(false)}
          shopLocations={selectedCard.shop_locations || []}
          onUpdateLocations={updateSelectedCardLocations}
        />
      )}
    </Box>
  );
}

export default CardList;
