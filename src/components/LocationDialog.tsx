import { useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    DialogContentText,
    Button,
    Box,
    Typography
} from '@mui/material';
import { LocationOn, Remove } from '@mui/icons-material';
import { type ShopLocation } from '../types';

interface LocationDialogProps {
    open: boolean;
    onClose: () => void;
    shopLocations: ShopLocation[];
    onUpdateLocations: (locations: ShopLocation[]) => void;
}

function LocationDialog({ 
    open, 
    onClose, 
    shopLocations, 
    onUpdateLocations
}: LocationDialogProps) {
    const [isGettingLocation, setIsGettingLocation] = useState(false);

    const addCurrentLocation = async () => {
        setIsGettingLocation(true);
        try {
            const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                if (!navigator.geolocation) {
                    reject(new Error('Geolocation is not supported by this browser'));
                    return;
                }
                
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 300000 // 5 minutes
                });
            });

            const newLocation: ShopLocation = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };

            // Check if this location already exists (within 100m)
            const exists = (shopLocations || []).some(loc => {
                const distance = Math.sqrt(
                    Math.pow((loc.lat - newLocation.lat) * 111000, 2) + 
                    Math.pow((loc.lng - newLocation.lng) * 111000, 2)
                );
                return distance < 100; // 100 meters
            });

            if (!exists) {
                onUpdateLocations([...(shopLocations || []), newLocation]);
                onClose();
            } else {
                alert('This location is already added (within 100m of existing location)');
            }
        } catch (error) {
            alert(`Error getting location: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsGettingLocation(false);
        }
    };

    const clearAllLocations = () => {
        onUpdateLocations([]);
        onClose();
    };

    const handleAddCurrentLocation = async () => {
        await addCurrentLocation();
    };

    const validLocationCount = (shopLocations || []).filter(loc => loc.lat !== 0 || loc.lng !== 0).length;

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="sm"
            fullWidth
        >
            <DialogTitle>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <LocationOn color="primary" />
                    <Typography variant="h6">Location Options</Typography>
                </Box>
            </DialogTitle>
            <DialogContent>
                <DialogContentText sx={{ mb: 2 }}>
                    This shop currently has {validLocationCount} location(s).
                    What would you like to do?
                </DialogContentText>
                
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Button
                        variant="contained"
                        startIcon={<LocationOn />}
                        onClick={handleAddCurrentLocation}
                        disabled={isGettingLocation}
                        fullWidth
                        sx={{ py: 1.5 }}
                    >
                        {isGettingLocation ? 'Getting Location...' : 'Add My Current Location'}
                    </Button>
                    
                    {validLocationCount > 0 && (
                        <Button
                            variant="outlined"
                            color="error"
                            startIcon={<Remove />}
                            onClick={clearAllLocations}
                            fullWidth
                            sx={{ py: 1.5 }}
                        >
                            Clear All Existing Locations
                        </Button>
                    )}
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>
                    Cancel
                </Button>
            </DialogActions>
        </Dialog>
    );
}

export default LocationDialog;