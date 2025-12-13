import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { type UserProfile } from '../types';
import { getProfilePath } from '../utils/firebasePaths';
import { handleError, validateUsername, ERROR_MESSAGES } from '../utils/errorHandler';
import {
  Box,
  Typography,
  TextField,
  Button,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Divider,
  CircularProgress
} from '@mui/material';
import { Close, Save, Person } from '@mui/icons-material';

interface UserProfileManagerProps {
  open: boolean;
  onClose: () => void;
}

function UserProfileManager({ open, onClose }: UserProfileManagerProps) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [username, setUsername] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  // Fetch user profile
  const fetchProfile = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const profileRef = doc(db, getProfilePath(user.uid));
      const profileDoc = await getDoc(profileRef);
      
      if (profileDoc.exists()) {
        const data = profileDoc.data() as UserProfile;
        setProfile(data);
        setUsername(data.username || '');
      } else {
        // Initialize profile if it doesn't exist
        const newProfile: UserProfile = {
          email: user.email || '',
          createdAt: new Date(),
        };
        await setDoc(profileRef, newProfile);
        setProfile(newProfile);
        setUsername('');
      }
    } catch (err) {
      handleError(err, 'Error fetching profile');
      setError(ERROR_MESSAGES.PROFILE_FETCH_FAILED);
    } finally {
      setLoading(false);
    }
  };

  // Save user profile
  const handleSaveProfile = async () => {
    if (!user) return;
    
    const usernameError = validateUsername(username);
    if (usernameError) {
      setError(usernameError);
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');
    
    try {
      const profileRef = doc(db, getProfilePath(user.uid));
      const updatedProfile: UserProfile = {
        email: user.email || '',
        username: username.trim() || undefined,
        updatedAt: new Date(),
        createdAt: profile?.createdAt || new Date(),
      };
      
      await setDoc(profileRef, updatedProfile);
      setProfile(updatedProfile);
      setSuccess('Profile updated successfully!');
    } catch (err) {
      handleError(err, 'Error saving profile');
      setError(ERROR_MESSAGES.PROFILE_UPDATE_FAILED);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (open && user) {
      fetchProfile();
      setError('');
      setSuccess('');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user]);

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Person />
            <Typography variant="h6">User Profile</Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Manage your profile information. Your username is optional and can be used for easier identification when sharing cards.
            </Typography>
            
            {error && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
                {error}
              </Alert>
            )}
            
            {success && (
              <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
                {success}
              </Alert>
            )}
            
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                fullWidth
                label="Email"
                variant="outlined"
                value={profile?.email || user?.email || ''}
                disabled
                helperText="Email cannot be changed"
              />
              
              <TextField
                fullWidth
                label="Username (Optional)"
                variant="outlined"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter a username"
                helperText="3-30 characters: letters, numbers, underscores, or hyphens"
              />
            </Box>

            {profile && (
              <>
                <Divider sx={{ my: 3 }} />
                
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {profile.createdAt && (
                    <Typography variant="caption" color="text.secondary">
                      Profile created: {new Date(profile.createdAt).toLocaleDateString()}
                    </Typography>
                  )}
                  {profile.updatedAt && (
                    <Typography variant="caption" color="text.secondary">
                      Last updated: {new Date(profile.updatedAt).toLocaleDateString()}
                    </Typography>
                  )}
                </Box>
              </>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button 
          onClick={handleSaveProfile} 
          variant="contained"
          startIcon={saving ? <CircularProgress size={16} /> : <Save />}
          disabled={loading || saving}
        >
          Save Profile
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default UserProfileManager;
