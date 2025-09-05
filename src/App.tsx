// src/App.tsx
import { useState, useEffect } from 'react';
import { collection, getDocs, type DocumentData, type QueryDocumentSnapshot } from "firebase/firestore";
import { db } from './firebase';
import AddCardForm from './components/AddCardForm';
import CardList from './components/CardList';
import { type CardContent } from './types';
import { performMagicClick } from './utils/magicClick';
import { 
  ThemeProvider, 
  createTheme,
  CssBaseline,
  AppBar,
  Toolbar,
  Typography,
  Box,
  Button
} from '@mui/material';
import { Add, CreditCard } from '@mui/icons-material';

function App() {
  const [cards, setCards] = useState<CardContent[]>([]);
  const [showAddCardForm, setShowAddCardForm] = useState<boolean>(false);
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const [logoHidden, setLogoHidden] = useState<boolean>(false);

  // Create a Material-UI theme
  const theme = createTheme({
    palette: {
      primary: {
        main: '#200943',
      },
      secondary: {
        main: '#fd3946',
      },
      background: {
        default: '#ab90d4',
        paper: '#ffffff',
      },
    },
  });

  // Function to fetch all cards
  const fetchCards = async () => {
    const querySnapshot = await getDocs(collection(db, import.meta.env.VITE_FIRESTORE_COLLECTION));
    // Explicitly type the document snapshot for clarity
    const cardsList = querySnapshot.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => ({
      id: doc.id,
      store_name: doc.data().store_name,
      code: doc.data().code,
      barcode_type: doc.data().barcode_type,
      shop_locations: doc.data().shop_locations || null,
    }));
    console.log(cardsList);
    setCards(cardsList as CardContent[]); // Assert the final array as Card[]
  };

  // Handle logo click - start spinning animation and select closest shop
  const handleLogoClick = async () => {
    if (cards.length === 0 || isSpinning) return;
    
    try {
      await performMagicClick(cards, setIsSpinning, setLogoHidden);
    } catch (error) {
      console.error('Error during magic click:', error);
      // Reset states in case of error
      setIsSpinning(false);
      setLogoHidden(false);
    }
  };

  // Fetch cards on component mount
  useEffect(() => {
    fetchCards();
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ 
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
      }}>
        <AppBar position="static" sx={{ width: '100%' }}>
            <Toolbar>
            <CreditCard sx={{ mr: 2 }} />
                        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              {import.meta.env.VITE_APP_NAME}
            </Typography>
            {!showAddCardForm && (
              <Button variant="outlined" color="secondary" startIcon={<Add />} onClick={() => setShowAddCardForm(true)}>
                Add Card
              </Button>
            )}
            </Toolbar>
        </AppBar>
        <Box sx={{ mt: 4, mb: 4, flexGrow: 1, width: '100%', px: 2 }}>
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center',
            width: '100%'
          }}>
            {!showAddCardForm && !logoHidden && (
              <Box sx={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center',
                mb: 4,
                width: '100%',
                position: 'relative',
                '& img': {
                  maxWidth: '300px',
                  width: '100%',
                  height: 'auto',
                  cursor: cards.length > 0 ? 'pointer' : 'default',
                  opacity: cards.length > 0 ? 1 : 0.6,
                  transition: 'transform 0.2s ease-in-out',
                  animation: isSpinning ? 'spinAndShrink 1s ease-in-out forwards' : 'none',
                  '&:hover': {
                    transform: cards.length > 0 && !isSpinning ? 'scale(1.05)' : 'scale(1)',
                  },
                },
                '@keyframes spinAndShrink': {
                  '0%': {
                    transform: 'rotate(0deg) scale(1)',
                    opacity: 1,
                  },
                  '100%': {
                    transform: 'rotate(720deg) scale(0)',
                    opacity: 0,
                  },
                },
              }}>
                <img 
                  src="/logo.png" 
                  alt={`${import.meta.env.VITE_APP_NAME} Logo`} 
                  onClick={handleLogoClick}
                />
              </Box>
            )}
            {showAddCardForm && <AddCardForm onCardAdded={fetchCards} onClose={() => setShowAddCardForm(false)} />}
            <CardList cards={cards} onCardUpdated={fetchCards} />
          </Box>
        </Box>
      </Box>
    </ThemeProvider>
  )
}

export default App