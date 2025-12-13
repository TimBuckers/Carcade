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
import { getCurrentLocation, areLocationsDuplicate, isValidLocation } from '../utils/geolocation';
import { handleError } from '../utils/errorHandler';

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
            const newLocation = await getCurrentLocation();

            // Check if this location already exists (within threshold)
            const exists = (shopLocations || []).some(loc => 
                areLocationsDuplicate(loc, newLocation)
            );

            if (!exists) {
                onUpdateLocations([...(shopLocations || []), newLocation]);
                onClose();
            } else {
                alert('This location is already added (within 100m of existing location)');
            }
        } catch (error) {
            const errorMessage = handleError(error, 'Error getting location');
            alert(errorMessage);
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

    const validLocationCount = (shopLocations || []).filter(isValidLocation).length;

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