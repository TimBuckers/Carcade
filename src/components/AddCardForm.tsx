import { useState, useRef, useEffect, type FormEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Quagga from '@ericblade/quagga2';
import { BarcodeTypes } from '../types';
import { addCard } from '../services/cardService';
import { logger } from '../utils/logger';
import { handleError, ERROR_MESSAGES } from '../utils/errorHandler';
import { BARCODE_SCANNER, UI } from '../constants';
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
    CardHeader
} from '@mui/material';
import { CameraAlt, Stop, Close } from '@mui/icons-material';

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
                                width: UI.VIDEO_WIDTH,
                                height: UI.VIDEO_HEIGHT,
                                facingMode: BARCODE_SCANNER.FACING_MODE
                            }
                        },
                        locator: {
                            patchSize: BARCODE_SCANNER.PATCH_SIZE,
                            halfSample: BARCODE_SCANNER.HALF_SAMPLE
                        },
                        numOfWorkers: BARCODE_SCANNER.NUM_WORKERS,
                        decoder: {
                            readers: [
                                "code_128_reader",
                                "ean_reader",
                                "code_39_reader",
                                "code_39_vin_reader"
                            ]
                        },
                        locate: true
                    }, (err: unknown) => {
                        if (err) {
                            const error = err as Error;
                            logger.error('Error initializing Quagga:', error);
                            setIsScanning(false);
                            setShouldStartScanning(false);
                            alert(ERROR_MESSAGES.SCANNER_INIT_FAILED + ': ' + error.message);
                            return;
                        }

                        // Set up barcode detection callback
                        Quagga.onDetected((result: { codeResult: { code: string; format: string } }) => {
                            setCode(result.codeResult.code);

                            // Map Quagga's format names to our BarcodeType keys
                            const detectedFormat = result.codeResult.format;

                            setBarcodeType(detectedFormat);

                            logger.debug('Barcode detected:', {
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
                    logger.error('Error starting scanner:', error);
                    setIsScanning(false);
                    setShouldStartScanning(false);

                    const err = error as Error & { name: string };
                    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                        alert(ERROR_MESSAGES.SCANNER_PERMISSION_DENIED);
                    } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
                        alert('No camera found on this device.');
                    } else {
                        alert(ERROR_MESSAGES.SCANNER_INIT_FAILED);
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
            Quagga.offDetected(() => { });
        } catch (error) {
            logger.error('Error stopping scanner:', error);
        }
        setIsScanning(false);
        setShouldStartScanning(false);
    };

    // Function to add a new card
    const addCardHandler = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (storeName.trim() === '' || code.trim() === '' || !user) return;

        try {
            await addCard(user.uid, {
                store_name: storeName,
                code,
                barcode_type: barcodeType,
                shop_locations: []
            });
            setStoreName('');
            setCode('');
            onCardAdded();
            onClose();
        } catch (e) {
            const errorMessage = handleError(e, 'Error adding card');
            alert(errorMessage);
        }
    };

    // Cleanup scanner on component unmount
    useEffect(() => {
        return () => {
            try {
                Quagga.stop();
                Quagga.offDetected(() => { });
            } catch (error) {
                logger.debug('Cleanup error:', error);
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
                    <Box component="form" onSubmit={addCardHandler} sx={{ mt: 2 }}>
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
        </>
    );
}

export default AddCardForm;
