import { useState, useEffect } from 'react';
import { collection, getDocs, deleteDoc, doc, query, where, collectionGroup, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { type SharedUser } from '../types';
import {
  Box,
  Typography,
  TextField,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Paper,
  Alert,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import { Delete, PersonAdd, Close } from '@mui/icons-material';

interface SharedUsersManagerProps {
  open: boolean;
  onClose: () => void;
}

function SharedUsersManager({ open, onClose }: SharedUsersManagerProps) {
  const { user } = useAuth();
  const [sharedUsers, setSharedUsers] = useState<SharedUser[]>([]);
  const [emailInput, setEmailInput] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  // Fetch list of users we're sharing with
  const fetchSharedUsers = async () => {
    if (!user) return;
    
    try {
      const sharedWithCollection = `users/${user.uid}/shared_with`;
      const querySnapshot = await getDocs(collection(db, sharedWithCollection));
      const usersList = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        email: doc.data().email,
        addedAt: doc.data().addedAt?.toDate() || new Date(),
      }));
      setSharedUsers(usersList);
    } catch (err) {
      console.error('Error fetching shared users:', err);
      setError('Failed to load shared users');
    }
  };

  // Add a new user to share with
  const handleAddUser = async () => {
    if (!user) return;
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailInput)) {
      setError('Please enter a valid email address');
      return;
    }

    // Prevent adding your own email
    if (emailInput.toLowerCase() === user.email?.toLowerCase()) {
      setError('You cannot share with yourself');
      return;
    }

    // Check if user is already in the list
    if (sharedUsers.some(u => u.email.toLowerCase() === emailInput.toLowerCase())) {
      setError('This user is already in your sharing list');
      return;
    }

    try {
      // Find the user by email in their profile
      const profilesQuery = query(
        collectionGroup(db, 'profile'),
        where('email', '==', emailInput.toLowerCase())
      );
      
      const profileSnapshot = await getDocs(profilesQuery);
      
      if (profileSnapshot.empty) {
        setError('User with this email not found. They need to log in at least once.');
        return;
      }
      
      // Get the user ID from the profile path
      const targetUserDoc = profileSnapshot.docs[0];
      const pathParts = targetUserDoc.ref.path.split('/');
      const targetUserId = pathParts[1]; // users/{userId}/profile/info
      
      // Create both entries for bidirectional lookup:
      // 1. In current user's shared_with collection
      const sharedWithCollection = `users/${user.uid}/shared_with`;
      await setDoc(doc(db, sharedWithCollection, targetUserId), {
        email: emailInput.toLowerCase(),
        userId: targetUserId,
        addedAt: new Date(),
      });
      
      // 2. In target user's sharing_with_me collection (reverse index)
      const sharingWithMeCollection = `users/${targetUserId}/sharing_with_me`;
      await setDoc(doc(db, sharingWithMeCollection, user.uid), {
        email: user.email?.toLowerCase(),
        userId: user.uid,
        addedAt: new Date(),
      });
      
      setSuccess(`Successfully added ${emailInput} to your sharing list`);
      setEmailInput('');
      setError('');
      fetchSharedUsers();
    } catch (err) {
      console.error('Error adding shared user:', err);
      setError('Failed to add user. Please try again.');
    }
  };

  // Remove a user from sharing list
  const handleRemoveUser = async (userId: string, email: string) => {
    if (!user) return;
    
    try {
      // Delete from current user's shared_with collection
      const sharedWithCollection = `users/${user.uid}/shared_with`;
      await deleteDoc(doc(db, sharedWithCollection, userId));
      
      // Delete from target user's sharing_with_me collection (reverse index)
      const sharingWithMeCollection = `users/${userId}/sharing_with_me`;
      await deleteDoc(doc(db, sharingWithMeCollection, user.uid));
      
      setSuccess(`Removed ${email} from your sharing list`);
      fetchSharedUsers();
    } catch (err) {
      console.error('Error removing shared user:', err);
      setError('Failed to remove user. Please try again.');
    }
  };

  useEffect(() => {
    if (open && user) {
      fetchSharedUsers();
      setError('');
      setSuccess('');
    }
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
          <Typography variant="h6">Manage Card Sharing</Typography>
          <IconButton onClick={onClose} size="small">
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Add users by email to share all your cards with them. They'll be able to view your cards when they log in.
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
          
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              fullWidth
              label="User Email"
              variant="outlined"
              size="small"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddUser()}
              placeholder="user@example.com"
            />
            <Button
              variant="contained"
              onClick={handleAddUser}
              startIcon={<PersonAdd />}
              disabled={!emailInput.trim()}
            >
              Add
            </Button>
          </Box>
        </Box>

        <Divider sx={{ my: 2 }} />

        <Typography variant="subtitle1" sx={{ mb: 1 }}>
          Sharing with ({sharedUsers.length})
        </Typography>

        {sharedUsers.length === 0 ? (
          <Paper sx={{ p: 3, textAlign: 'center', bgcolor: 'background.default' }}>
            <Typography variant="body2" color="text.secondary">
              You're not sharing with anyone yet. Add users above to share your cards.
            </Typography>
          </Paper>
        ) : (
          <List sx={{ bgcolor: 'background.paper' }}>
            {sharedUsers.map((sharedUser) => (
              <ListItem key={sharedUser.id} divider>
                <ListItemText
                  primary={sharedUser.email}
                  secondary={`Added on ${sharedUser.addedAt.toLocaleDateString()}`}
                />
                <ListItemSecondaryAction>
                  <IconButton
                    edge="end"
                    onClick={() => handleRemoveUser(sharedUser.id, sharedUser.email)}
                    color="error"
                  >
                    <Delete />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

export default SharedUsersManager;
