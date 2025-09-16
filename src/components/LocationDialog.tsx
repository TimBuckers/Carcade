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
import { LocationOn, Add, Remove } from '@mui/icons-material';
import { type ShopLocation } from '../types';

interface LocationDialogProps {
    open: boolean;
    onClose: () => void;
    shopLocations: ShopLocation[];
    onAddCurrentLocation: () => Promise<void>;
    onClearAllLocations: () => void;
}

function LocationDialog({ 
    open, 
    onClose, 
    shopLocations, 
    onAddCurrentLocation, 
    onClearAllLocations 
}: LocationDialogProps) {
    const [isGettingLocation, setIsGettingLocation] = useState(false);

    const handleAddCurrentLocation = async () => {
        setIsGettingLocation(true);
        try {
            await onAddCurrentLocation();
        } finally {
            setIsGettingLocation(false);
        }
    };

    const validLocationCount = shopLocations.filter(loc => loc.lat !== 0 || loc.lng !== 0).length;

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
                            onClick={onClearAllLocations}
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