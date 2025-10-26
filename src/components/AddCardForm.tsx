import { useState, useRef, useEffect, type FormEvent } from 'react';
import { collection, addDoc } from "firebase/firestore";
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import Quagga from '@ericblade/quagga2';
import { BarcodeTypes, type ShopLocation } from '../types';
import LocationDialog from './LocationDialog';
import {
    Card,
    CardContent,
    TextField,
    Button,
    Box,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Typography,
    Paper,
    IconButton,
    CardHeader,
    Accordion,
    AccordionSummary,
    AccordionDetails
} from '@mui/material';
import { CameraAlt, Stop, Close, Add, Remove, ExpandMore, LocationOn } from '@mui/icons-material';

interface AddCardFormProps {
    onCardAdded: () => void;
    onClose: () => void;
}

function AddCardForm({ onCardAdded, onClose }: AddCardFormProps) {
    const { user } = useAuth();
    const [storeName, setStoreName] = useState<string>('');
    const [code, setCode] = useState<string>('');
    const [barcodeType, setBarcodeType] = useState<keyof typeof BarcodeTypes>('EAN13');
    const [isScanning, setIsScanning] = useState<boolean>(false);
    const [shouldStartScanning, setShouldStartScanning] = useState<boolean>(false);
    const [scanSuccess, setScanSuccess] = useState<boolean>(false);
    const [locationDialogOpen, setLocationDialogOpen] = useState<boolean>(false);
    const videoRef = useRef<HTMLDivElement>(null);

    // Function to initiate barcode scanning
    const startScanning = () => {
        setIsScanning(true);
        setShouldStartScanning(true);
    };

    // Effect to start scanner after video element is rendered
    useEffect(() => {
        const initializeScanner = async () => {
            if (shouldStartScanning && isScanning && videoRef.current) {
                setShouldStartScanning(false);

                try {
                    // Initialize Quagga2 barcode scanner directly
                    Quagga.init({
                        inputStream: {
                            name: "Live",
                            type: "LiveStream",
                            target: videoRef.current,
                            constraints: {
                                width: 400,
                                height: 300,
                                facingMode: "environment"
                            }
                        },
                        locator: {
                            patchSize: "medium",
                            halfSample: true
                        },
                        numOfWorkers: 2,
                        decoder: {
                            readers: [
                                "code_128_reader",
                                "ean_reader",
                                "code_39_reader",
                                "code_39_vin_reader"
                                // "ean_8_reader",
                            ]
                        },
                        locate: true
                    }, (err: any) => {
                        if (err) {
                            console.error('Error initializing Quagga:', err);
                            setIsScanning(false);
                            setShouldStartScanning(false);
                            alert('Error initializing barcode scanner: ' + err.message);
                            return;
                        }

                        // Set up barcode detection callback
                        Quagga.onDetected((result: any) => {
                            setCode(result.codeResult.code);

                            // Map Quagga's format names to our BarcodeType keys
                            const detectedFormat = result.codeResult.format;

                            setBarcodeType(detectedFormat);

                            console.log('Barcode detected:', {
                                code: result.codeResult.code,
                                detectedFormat,
                                mappedType: detectedFormat
                            });

                            setScanSuccess(true);
                            setTimeout(() => {
                                stopScanning();
                                setScanSuccess(false);
                            }, 1000);
                        });

                        // Start the scanner
                        Quagga.start();

                        // Ensure Quagga's video and canvas elements fill the container properly
                        if (videoRef.current) {
                            // Apply CSS to make Quagga's internal elements fit properly
                            const videoElements = videoRef.current.querySelectorAll('video, canvas');
                            videoElements.forEach((element: Element) => {
                                const htmlElement = element as HTMLElement;
                                htmlElement.style.width = '100%';
                                htmlElement.style.height = '100%';
                                htmlElement.style.objectFit = 'cover';
                                htmlElement.style.borderRadius = '8px';
                            });
                        }
                    });

                } catch (error) {
                    console.error('Error starting scanner:', error);
                    setIsScanning(false);
                    setShouldStartScanning(false);

                    const err = error as any;
                    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                        alert('Camera permission denied. Please allow camera access in your browser settings and try again.');
                    } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
                        alert('No camera found on this device.');
                    } else {
                        alert('Error accessing camera. Please check your camera permissions and try again.');
                    }
                }
            }
        };

        initializeScanner();
    }, [shouldStartScanning, isScanning]);

    // Function to stop barcode scanning
    const stopScanning = () => {
        try {
            Quagga.stop();
            Quagga.offDetected((_result: any) => { });
        } catch (error) {
            console.error('Error stopping scanner:', error);
        }
        setIsScanning(false);
        setShouldStartScanning(false);
    };

    const openLocationDialog = () => {
        setLocationDialogOpen(true);
    };

    // Function to add a new card
    const addCard = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault(); // Prevent form refresh
        if (storeName.trim() === '' || code.trim() === '' || !user) return;

        try {
            const userCollection = `users/${user.uid}/${import.meta.env.VITE_FIRESTORE_COLLECTION}`;
            await addDoc(collection(db, userCollection), {
                store_name: storeName,
                code,
                barcode_type: barcodeType,
                shop_locations: []
            });
            setStoreName(''); // Clear input
            setCode(''); // Clear input
            onCardAdded(); // Notify parent component to refresh the list
            onClose(); // Close the form after successfully adding the card
        } catch (e) {
            console.error("Error adding document: ", e);
        }
    };

    // Cleanup scanner on component unmount
    useEffect(() => {
        return () => {
            try {
                Quagga.stop();
                Quagga.offDetected((_result: any) => { });
            } catch (error) {
                console.log('Cleanup error:', error);
            }
        };
    }, []);

    return (
        <>
            <Card sx={{ maxWidth: 600, margin: 2 }}>
                <CardHeader
                    title="Add New Card"
                    action={
                        <IconButton onClick={onClose} aria-label="close">
                            <Close />
                        </IconButton>
                    }
                />
                <CardContent>
                    <Box component="form" onSubmit={addCard} sx={{ mt: 2 }}>
                        <TextField
                            fullWidth
                            label="Store Name"
                            value={storeName}
                            onChange={(e) => setStoreName(e.target.value)}
                            margin="normal"
                            required
                        />
                        {isScanning && (
                            <Paper elevation={2} sx={{ mt: 3, p: 2 }}>
                                <div
                                    ref={videoRef}
                                    style={{
                                        width: '100%',
                                        maxWidth: 400,
                                        height: 300,
                                        borderRadius: 8,
                                        display: 'block',
                                        margin: '0 auto',
                                        border: scanSuccess ? '3px solid #4caf50' : '1px solid #ccc',
                                        transition: 'border 0.3s ease',
                                        overflow: 'hidden',
                                        position: 'relative',
                                        backgroundColor: '#000'
                                    }}
                                />
                                <Typography
                                    variant="body2"
                                    color={scanSuccess ? "success.main" : "text.secondary"}
                                    align="center"
                                    sx={{
                                        mt: 1,
                                        fontWeight: scanSuccess ? 'bold' : 'normal',
                                        transition: 'all 0.3s ease'
                                    }}
                                >
                                    {scanSuccess ? '✅ Barcode detected successfully!' :
                                        <>
                                            Point your camera at a <strong>barcode</strong>
                                            <br />
                                            <Typography variant="caption" component="span">
                                                Supports: Code128, EAN-13 and Code39.
                                            </Typography>
                                        </>
                                    }
                                </Typography>
                            </Paper>
                        )}
                        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end', mt: 0 }}>
                            <TextField
                                label="Code"
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                                margin="normal"
                                required
                                sx={{ flexGrow: 1 }}
                            />
                        </Box>
                        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end', mt: 2 }}>
                            <FormControl sx={{ minWidth: 120, mb: 1 }}>
                                <InputLabel>Barcode Type</InputLabel>
                                <Select
                                    value={barcodeType}
                                    label="Barcode Type"
                                    onChange={(e) => setBarcodeType(e.target.value as keyof typeof BarcodeTypes)}
                                >
                                    <MenuItem value="ean_13">{BarcodeTypes.EAN13}</MenuItem>
                                    <MenuItem value="code_128">{BarcodeTypes.CODE128}</MenuItem>
                                    <MenuItem value="code_39">{BarcodeTypes.CODE39}</MenuItem>
                                    <MenuItem value="qr_code">{BarcodeTypes.QRCODE}</MenuItem>
                                </Select>
                            </FormControl>

                            <Button
                                variant="contained"
                                color={isScanning ? "error" : "primary"}
                                onClick={isScanning ? stopScanning : startScanning}
                                startIcon={isScanning ? <Stop /> : <CameraAlt />}
                                sx={{ mb: 1, minWidth: 120, height: 56 }}
                            >
                                {isScanning ? 'Stop' : 'Scan'}
                            </Button>
                        </Box>

                        <Button
                            type="submit"
                            variant="contained"
                            color="primary"
                            fullWidth
                            sx={{ mt: 3, py: 1.5 }}
                            disabled={!storeName.trim() || !code.trim()}
                        >
                            Add Card
                        </Button>
                    </Box>
                </CardContent>
            </Card>

            {/* Location Options Dialog */}
            <LocationDialog
                open={locationDialogOpen}
                onClose={() => setLocationDialogOpen(false)}
            />
        </>
    );
}

export default AddCardForm;
