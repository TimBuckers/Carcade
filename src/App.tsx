// src/App.tsx
import { useState, useEffect } from 'react';
import { collection, getDocs, type DocumentData, type QueryDocumentSnapshot } from "firebase/firestore";
import { db } from './firebase';
import { useAuth } from './contexts/AuthContext';
import AddCardForm from './components/AddCardForm';
import CardList from './components/CardList';
import LoginPage from './components/LoginPage';
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
  Button,
  Avatar,
  Menu,
  MenuItem,
  CircularProgress
} from '@mui/material';
import { Add, CreditCard, AccountCircle, Logout } from '@mui/icons-material';

function App() {
  const { user, loading, logout } = useAuth();
  const [cards, setCards] = useState<CardContent[]>([]);
  const [showAddCardForm, setShowAddCardForm] = useState<boolean>(false);
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const [logoHidden, setLogoHidden] = useState<boolean>(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

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
    if (!user) return; // Only fetch cards if user is authenticated
    const userCollection = `users/${user.uid}/${import.meta.env.VITE_FIRESTORE_COLLECTION}`;
    const querySnapshot = await getDocs(collection(db, userCollection));
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

  // Fetch cards when user changes or component mounts
  useEffect(() => {
    if (user) {
      fetchCards();
    }
  }, [user]);

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          minHeight: '100vh' 
        }}>
          <CircularProgress size={60} />
        </Box>
      </ThemeProvider>
    );
  }

  // Show login page if user is not authenticated
  if (!user) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <LoginPage />
      </ThemeProvider>
    );
  }

  // Handle user menu
  const handleUserMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleUserMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    try {
      await logout();
      handleUserMenuClose();
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

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
              <Button variant="outlined" color="secondary" startIcon={<Add />} onClick={() => setShowAddCardForm(true)} sx={{ mr: 2 }}>
                Add Card
              </Button>
            )}
            
            {/* User Menu */}
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Button
                onClick={handleUserMenuOpen}
                sx={{ 
                  color: 'white',
                  textTransform: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1
                }}
              >
                {user.photoURL ? (
                  <Avatar src={user.photoURL} alt={user.displayName || 'User'} sx={{ width: 32, height: 32 }} />
                ) : (
                  <AccountCircle sx={{ fontSize: 32 }} />
                )}
                <Typography variant="body2" sx={{ display: { xs: 'none', sm: 'block' } }}>
                  {user.displayName || user.email}
                </Typography>
              </Button>
              <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleUserMenuClose}
                anchorOrigin={{
                  vertical: 'bottom',
                  horizontal: 'right',
                }}
                transformOrigin={{
                  vertical: 'top',
                  horizontal: 'right',
                }}
              >
                <MenuItem onClick={handleLogout}>
                  <Logout sx={{ mr: 1 }} />
                  Sign Out
                </MenuItem>
              </Menu>
            </Box>
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