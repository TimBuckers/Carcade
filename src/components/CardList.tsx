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
import { incrementCardOpenCount } from '../services/cardService';
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

  // Generate a consistent color based on card code
  const getCardColor = (code: string): { primary: string; secondary: string; text: string } => {
    // Use store name as fallback if code is empty
    const colorSource = code && code.trim() !== '' ? code : 'default';
    
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < colorSource.length; i++) {
      hash = colorSource.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    // Ensure hash is positive and not zero
    hash = Math.abs(hash) || 1;
    
    // Color palette with 18 different colors
    const colors = [
      // Reds / Pinks
      { hex: '#e0373e', name: 'Red' },
      { hex: '#ee5355', name: 'Coral Red' },
      { hex: '#FF69B4', name: 'Hot Pink' },
      // Oranges / Yellows
      { hex: '#f5b227', name: 'Golden Orange' },
      { hex: '#f58c21', name: 'Orange' },
      { hex: '#FFFF00', name: 'Yellow' },
      // Yellow-Greens
      { hex: '#69c761', name: 'Lime Green' },
      { hex: '#FFD700', name: 'Gold' },
      { hex: '#3CB371', name: 'Medium Sea Green' },
      // Greens
      { hex: '#0bb577', name: 'Green' },
      { hex: '#40E0D0', name: 'Turquoise' },
      { hex: '#99FFFF', name: 'Cyan' },
      // Blues
      { hex: '#03a3e3', name: 'Sky Blue' },
      { hex: '#2e4ac1', name: 'Royal Blue' },
      { hex: '#000080', name: 'Navy' },
      // Purples
      { hex: '#9850a4', name: 'Purple' },
      { hex: '#EE82EE', name: 'Violet' },
    ];
    
    // Use modulo to get a color index
    const colorIndex = hash % colors.length;
    const selectedColor = colors[colorIndex];
    
    // Helper function to convert hex to RGB
    const hexToRgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      } : { r: 0, g: 0, b: 0 };
    };
    
    // Helper function to create a lighter version of a color
    const lightenColor = (hex: string, percent: number) => {
      const rgb = hexToRgb(hex);
      const r = Math.min(255, Math.floor(rgb.r + (255 - rgb.r) * percent));
      const g = Math.min(255, Math.floor(rgb.g + (255 - rgb.g) * percent));
      const b = Math.min(255, Math.floor(rgb.b + (255 - rgb.b) * percent));
      return `rgb(${r}, ${g}, ${b})`;
    };
    
    // Helper function to create a darker version of a color
    const darkenColor = (hex: string, percent: number) => {
      const rgb = hexToRgb(hex);
      const r = Math.floor(rgb.r * (1 - percent));
      const g = Math.floor(rgb.g * (1 - percent));
      const b = Math.floor(rgb.b * (1 - percent));
      return `rgb(${r}, ${g}, ${b})`;
    };
    
    return {
      primary: `linear-gradient(135deg, ${lightenColor(selectedColor.hex, 0.55)} 0%, ${lightenColor(selectedColor.hex, 0.35)} 100%)`,
      secondary: selectedColor.hex,
      text: darkenColor(selectedColor.hex, 0.3)
    };
  };

  // Handle card click - increment counter and open modal
  const handleCardClick = async (card: CardContent) => {
    setSelectedCard(card);
    
    // Increment open count in database
    if (user) {
      // For shared cards, the ID is in the format "ownerId_cardId"
      // We need to extract the real card ID and owner ID
      const ownerId = card.ownerId || user.uid;
      const cardId = card.ownerId ? card.id.split('_')[1] : card.id;
      
      await incrementCardOpenCount(ownerId, cardId);
    }
  };

  const getBarcodeORQRImage = (code: string, barcodeType: string): JSX.Element | null => {
    if (barcodeType === BarcodeTypes.QRCODE) {
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
            format: BarcodeTypes[barcodeType as keyof typeof BarcodeTypes],
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
            {cards.map(card => {
              const cardColors = getCardColor(card.code);
              return (
              <Card 
                key={card.id}
                data-card-id={card.id}
                elevation={3}
                onClick={() => handleCardClick(card)}
                sx={{ 
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  cursor: 'pointer',
                  position: 'relative',
                  border: `4px solid ${cardColors.secondary}`,
                  borderRadius: '10px',
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
                    <CreditCard sx={{ mr: 1 }} />
                    <Typography variant="h6" component="h3" noWrap>
                      {card.store_name}
                    </Typography>
                  </Box>
                  
                  <Box sx={{ 
                    textAlign: 'center', 
                    mb: 2,
                    display: 'inline-flex',
                    width: '100%',
                    justifyContent: 'center',
                    pointerEvents: 'none'
                  }}>
                    <Box sx={{
                      backgroundColor: '#fff',
                      border: '2px solid #fff',
                      borderRadius: 1,
                      padding: 1,
                      display: 'inline-block'
                    }}>
                      {card.barcode_type && getBarcodeORQRImage(card.code, card.barcode_type)}
                    </Box>
                  </Box>
                  
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                      {card.code}
                    </Typography>
                    <Chip 
                      label={card.barcode_type} 
                      size="small" 
                      variant="outlined"
                    />
                  </Box>
                </MuiCardContent>
              </Card>
              );
            })}
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
          {selectedCard && (() => {
            const modalColors = getCardColor(selectedCard.code);
            return (
            <Card 
              elevation={12}
              sx={{
                width: '100%',
                maxWidth: { xs: '90vw', sm: '90vw', md: 600 },
                minWidth: { xs: '280px', sm: '350px', md: '400px' },
                position: 'relative',
                background: modalColors.primary,
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
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 3, flexWrap: 'wrap' }}>
                  <Typography variant="h4" component="h3" sx={{ fontWeight: 'bold', flexGrow: 1, minWidth: 0, wordBreak: 'break-word' }}>
                    {selectedCard.store_name}
                  </Typography>
                  {selectedCard.shop_locations && selectedCard.shop_locations.length > 0 && (
                    <Box 
                      sx={{ 
                        display: 'flex', 
                        alignItems: 'center',
                        cursor: 'pointer',
                        padding: 1,
                        borderRadius: 1,
                        flexShrink: 0,
                        '&:hover': {
                          backgroundColor: 'rgba(76, 175, 80, 0.1)',
                          transform: 'scale(1.05)',
                        },
                        transition: 'all 0.2s ease-in-out'
                      }}
                      onClick={() => setLocationDialogOpen(true)}
                    >
                      <LocationOn sx={{ mr: 0.5, color: 'success.main' }} />
                      <Typography variant="body2" color="success.main" sx={{ whiteSpace: 'nowrap' }}>
                        {selectedCard.shop_locations.length} location{selectedCard.shop_locations.length > 1 ? 's' : ''}
                      </Typography>
                    </Box>
                  )}
                  {(!selectedCard.shop_locations || selectedCard.shop_locations.length === 0) && (
                    <Box 
                      sx={{ 
                        display: 'flex', 
                        alignItems: 'center',
                        cursor: 'pointer',
                        padding: 1,
                        borderRadius: 1,
                        flexShrink: 0,
                        '&:hover': {
                          backgroundColor: 'rgba(255, 152, 0, 0.1)',
                          transform: 'scale(1.05)',
                        },
                        transition: 'all 0.2s ease-in-out'
                      }}
                      onClick={() => setLocationDialogOpen(true)}
                    >
                      <LocationOn sx={{ mr: 0.5, color: 'warning.main' }} />
                      <Typography variant="body2" color="warning.main" sx={{ whiteSpace: 'nowrap' }}>
                        Add location
                      </Typography>
                    </Box>
                  )}
                </Box>
                
                <Box sx={{ 
                  textAlign: 'center', 
                  mb: 3,
                  display: 'flex',
                  justifyContent: 'center'
                }}>
                  <Box sx={{
                    backgroundColor: '#fff',
                    border: '3px solid #fff',
                    borderRadius: 1,
                    padding: 2,
                    display: 'inline-block',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
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
                </Box>
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 3 }}>
                  <Typography variant="h6" sx={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                    {selectedCard.code}
                  </Typography>
                  <Chip 
                    label={selectedCard.barcode_type} 
                    size="medium" 
                    variant="outlined" 
                    sx={{ 
                      fontWeight: 'bold'
                    }}
                  />
                </Box>
                
                {/* Open count display */}
                <Box sx={{ 
                  display: 'flex', 
                  justifyContent: 'center', 
                  alignItems: 'center',
                  mt: 2,
                  pt: 2,
                  borderTop: '1px solid rgba(0, 0, 0, 0.1)'
                }}>
                  <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    Opened {selectedCard.openCount || 0} {(selectedCard.openCount || 0) === 1 ? 'time' : 'times'}
                  </Typography>
                </Box>
              </MuiCardContent>
            </Card>
            );
          })()}
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
