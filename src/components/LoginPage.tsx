import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { handleError, ERROR_MESSAGES } from '../utils/errorHandler';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Container,
} from '@mui/material';
import { Google, CreditCard } from '@mui/icons-material';

const LoginPage: React.FC = () => {
  const { signInWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setError('');
      await signInWithGoogle();
    } catch (error) {
      handleError(error, 'Login error');
      setError(ERROR_MESSAGES.AUTH_FAILED);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          px: 2,
        }}
      >
        {/* App Logo and Title */}
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Box sx={{ mb: 3 }}>
            <img 
              src="/logo.png" 
              alt={`${import.meta.env.VITE_APP_NAME} Logo`}
              style={{
                maxWidth: '200px',
                width: '100%',
                height: 'auto',
              }}
            />
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
            <CreditCard sx={{ mr: 1, fontSize: 32, color: 'primary.main' }} />
            <Typography variant="h4" component="h1" color="primary">
              {import.meta.env.VITE_APP_NAME}
            </Typography>
          </Box>
          <Typography variant="subtitle1" color="text.secondary">
            Sign in to manage your loyalty cards
          </Typography>
        </Box>

        {/* Login Card */}
        <Card sx={{ width: '100%', maxWidth: 400 }}>
          <CardContent sx={{ p: 4 }}>
            <Typography variant="h5" component="h2" align="center" gutterBottom>
              Welcome Back
            </Typography>
            <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>
              Sign in with your Google account to continue
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {error}
              </Alert>
            )}

            <Button
              fullWidth
              variant="contained"
              size="large"
              startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <Google />}
              onClick={handleGoogleSignIn}
              disabled={loading}
              sx={{
                py: 1.5,
                textTransform: 'none',
                fontSize: '1.1rem',
                backgroundColor: '#4285f4',
                '&:hover': {
                  backgroundColor: '#3367d6',
                },
                '&:disabled': {
                  backgroundColor: '#9aa0a6',
                },
              }}
            >
              {loading ? 'Signing in...' : 'Sign in with Google'}
            </Button>

            <Typography variant="caption" color="text.secondary" align="center" sx={{ display: 'block', mt: 3 }}>
              By signing in, you agree to our terms of service and privacy policy.
            </Typography>
          </CardContent>
        </Card>
      </Box>
    </Container>
  );
};

export default LoginPage;